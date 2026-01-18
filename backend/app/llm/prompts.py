"""LLM prompts for Luminate video automation."""

import math

RESEARCH_SYSTEM_PROMPT = """You are a research assistant specializing in creating educational content for YouTube videos.
Your task is to research topics thoroughly and present information in a clear, engaging way.
Always cite sources when possible and provide factual, accurate information.
Format your response in markdown with clear headings and bullet points.
Include a "Key Points" section at the beginning and a "Sources" section at the end."""

CONTENT_SYSTEM_PROMPT = """You are a content creator specializing in YouTube video presentations.
Create engaging, well-structured content suitable for video slides.
Use markdown formatting for the output.
Each slide should be clearly marked with "---" separators (Slidev format)."""

SCRIPT_SYSTEM_PROMPT = """You are a script writer for YouTube videos.
Write natural, conversational scripts that are easy to read aloud.
Avoid overly formal language - be engaging and personable.
The script should flow naturally when spoken."""


DEPTH_INSTRUCTIONS = {
    "quick": "Provide a brief overview in about 300-500 words.",
    "detailed": "Provide a comprehensive overview in about 800-1200 words with multiple sections.",
    "comprehensive": "Provide an in-depth analysis in about 1500-2500 words with extensive detail, examples, and multiple perspectives.",
}

FORMAT_INSTRUCTIONS = {
    "presentation": "Create slide-based presentation content with clear sections for each slide.",
    "tutorial": "Create step-by-step tutorial content with practical instructions.",
    "explainer": "Create educational explainer content that breaks down complex concepts.",
}


def get_research_prompt(topic: str, depth: str = "detailed") -> str:
    """Generate the user prompt for research generation."""
    depth_instruction = DEPTH_INSTRUCTIONS.get(depth, DEPTH_INSTRUCTIONS["detailed"])

    return f"""Research the following topic for a YouTube video: "{topic}"

{depth_instruction}

Structure your research as follows:
1. **Key Points** - A bulleted summary of the main takeaways
2. **Introduction** - Brief context and why this topic matters
3. **Main Content** - Detailed exploration of the topic with relevant facts and insights
4. **Practical Applications** - How viewers can apply this knowledge
5. **Sources** - List any referenced materials (use placeholder URLs if needed)

Make the content engaging and suitable for video narration."""


def get_content_prompt(research: str, format: str = "presentation", target_length: int = 10) -> str:
    """Generate the user prompt for content/slide generation."""
    format_instruction = FORMAT_INSTRUCTIONS.get(format, FORMAT_INSTRUCTIONS["presentation"])
    min_slides = math.ceil(target_length / 2)
    max_slides = math.ceil(target_length * 0.8)

    return f"""Based on this research:

{research}

Create {format} content for a {target_length}-minute YouTube video.

{format_instruction}

Format the content using Slidev markdown syntax:
- Use "---" to separate slides
- Use "# " for slide titles
- Use bullet points for key points
- Include speaker notes after each slide using HTML comments <!-- notes -->

Target approximately {min_slides} to {max_slides} slides.
Each slide should have 3-5 bullet points maximum for readability."""


def get_script_prompt(slide_content: str, slide_index: int) -> str:
    """Generate the user prompt for script generation."""
    return f"""Write a video script for the following slide content:

{slide_content}

This is slide {slide_index + 1} of the presentation.

Guidelines:
- Write in a conversational tone
- Include natural transitions
- Aim for about 30-60 seconds of speaking time (75-150 words)
- Don't just read the bullet points - expand on them
- Include brief pauses indicated by "..."

Return ONLY the script text, no additional formatting."""
