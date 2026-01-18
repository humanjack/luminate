"""Project API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import uuid
import time
import json

from app.core.database import get_db
from app.models import (
    Project,
    ResearchData,
    ContentData,
    Slide,
    Script,
    Recording,
    AnalysisResult,
    Video,
)
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.research import ResearchCreate, ResearchUpdate
from app.schemas.content import ContentCreate, ContentUpdate
from app.schemas.slide import SlideCreate, SlideUpdate
from app.schemas.script import ScriptCreate, ScriptUpdate
from app.schemas.recording import RecordingCreate
from app.schemas.analysis import AnalysisCreate
from app.schemas.video import VideoCreate, VideoUpdate

router = APIRouter()


# Project CRUD
@router.get("")
async def list_projects(db: Session = Depends(get_db)):
    """List all projects ordered by updated_at."""
    projects = db.query(Project).order_by(desc(Project.updated_at)).all()
    return [p.to_dict() for p in projects]


@router.post("", status_code=201)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project."""
    now = int(time.time() * 1000)
    new_project = Project(
        id=str(uuid.uuid4()),
        name=project.name,
        current_step=1,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project.to_dict()


@router.get("/{project_id}")
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """Get a project with all related data."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch related data
    research = db.query(ResearchData).filter(ResearchData.project_id == project_id).first()
    content = db.query(ContentData).filter(ContentData.project_id == project_id).first()
    slides = db.query(Slide).filter(Slide.project_id == project_id).order_by(Slide.index).all()
    scripts = db.query(Script).filter(Script.project_id == project_id).order_by(Script.slide_index).all()
    recordings = db.query(Recording).filter(Recording.project_id == project_id).all()
    analysis_results = db.query(AnalysisResult).filter(AnalysisResult.project_id == project_id).all()
    videos = db.query(Video).filter(Video.project_id == project_id).all()

    result = project.to_dict()
    result["researchData"] = research.to_dict() if research else None
    result["contentData"] = content.to_dict() if content else None
    result["slides"] = [s.to_dict() for s in slides]
    result["scripts"] = [s.to_dict() for s in scripts]
    result["recordings"] = [r.to_dict() for r in recordings]
    result["analysisResults"] = [a.to_dict() for a in analysis_results]
    result["videos"] = [v.to_dict() for v in videos]

    return result


@router.patch("/{project_id}")
async def update_project(
    project_id: str, updates: ProjectUpdate, db: Session = Depends(get_db)
):
    """Update a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = updates.model_dump(exclude_unset=True)
    if update_data:
        for key, value in update_data.items():
            setattr(project, key, value)
        project.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(project)

    return project.to_dict()


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project and all related data."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return {"success": True}


# Research routes
@router.get("/{project_id}/research")
async def get_research(project_id: str, db: Session = Depends(get_db)):
    """Get research data for a project."""
    research = db.query(ResearchData).filter(ResearchData.project_id == project_id).first()
    if not research:
        raise HTTPException(status_code=404, detail="Research data not found")
    return research.to_dict()


@router.post("/{project_id}/research", status_code=201)
async def create_research(
    project_id: str, research: ResearchCreate, db: Session = Depends(get_db)
):
    """Create research data for a project."""
    now = int(time.time() * 1000)
    sources_json = json.dumps(research.sources) if research.sources else None

    new_research = ResearchData(
        id=str(uuid.uuid4()),
        project_id=project_id,
        topic=research.topic,
        depth=research.depth,
        content=research.content,
        sources=sources_json,
        created_at=now,
        updated_at=now,
    )
    db.add(new_research)
    db.commit()
    db.refresh(new_research)
    return new_research.to_dict()


@router.patch("/{project_id}/research")
async def update_research(
    project_id: str, updates: ResearchUpdate, db: Session = Depends(get_db)
):
    """Update research data for a project."""
    research = db.query(ResearchData).filter(ResearchData.project_id == project_id).first()
    if not research:
        raise HTTPException(status_code=404, detail="Research data not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "sources" in update_data and update_data["sources"] is not None:
        update_data["sources"] = json.dumps(update_data["sources"])

    for key, value in update_data.items():
        setattr(research, key, value)
    research.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(research)
    return research.to_dict()


# Content routes
@router.get("/{project_id}/content")
async def get_content(project_id: str, db: Session = Depends(get_db)):
    """Get content data for a project."""
    content = db.query(ContentData).filter(ContentData.project_id == project_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content data not found")
    return content.to_dict()


@router.post("/{project_id}/content", status_code=201)
async def create_content(
    project_id: str, content: ContentCreate, db: Session = Depends(get_db)
):
    """Create content data for a project."""
    now = int(time.time() * 1000)
    outline_json = json.dumps(content.outline) if content.outline else None

    new_content = ContentData(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=content.title,
        format=content.format,
        target_length=content.target_length,
        outline=outline_json,
        markdown=content.markdown,
        created_at=now,
        updated_at=now,
    )
    db.add(new_content)
    db.commit()
    db.refresh(new_content)
    return new_content.to_dict()


@router.patch("/{project_id}/content")
async def update_content(
    project_id: str, updates: ContentUpdate, db: Session = Depends(get_db)
):
    """Update content data for a project."""
    content = db.query(ContentData).filter(ContentData.project_id == project_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content data not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "outline" in update_data and update_data["outline"] is not None:
        update_data["outline"] = json.dumps(update_data["outline"])

    for key, value in update_data.items():
        setattr(content, key, value)
    content.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(content)
    return content.to_dict()


# Slides routes
@router.get("/{project_id}/slides")
async def list_slides(project_id: str, db: Session = Depends(get_db)):
    """List all slides for a project."""
    slides = db.query(Slide).filter(Slide.project_id == project_id).order_by(Slide.index).all()
    return [s.to_dict() for s in slides]


@router.post("/{project_id}/slides", status_code=201)
async def create_slide(
    project_id: str, slide: SlideCreate, db: Session = Depends(get_db)
):
    """Create a slide for a project."""
    now = int(time.time() * 1000)
    new_slide = Slide(
        id=str(uuid.uuid4()),
        project_id=project_id,
        index=slide.index,
        markdown=slide.markdown,
        image_data=slide.image_data,
        theme=slide.theme,
        created_at=now,
        updated_at=now,
    )
    db.add(new_slide)
    db.commit()
    db.refresh(new_slide)
    return new_slide.to_dict()


@router.patch("/{project_id}/slides/{slide_id}")
async def update_slide(
    project_id: str, slide_id: str, updates: SlideUpdate, db: Session = Depends(get_db)
):
    """Update a slide."""
    slide = db.query(Slide).filter(Slide.id == slide_id, Slide.project_id == project_id).first()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(slide, key, value)
    slide.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(slide)
    return slide.to_dict()


@router.delete("/{project_id}/slides/{slide_id}")
async def delete_slide(project_id: str, slide_id: str, db: Session = Depends(get_db)):
    """Delete a slide."""
    slide = db.query(Slide).filter(Slide.id == slide_id, Slide.project_id == project_id).first()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    db.delete(slide)
    db.commit()
    return {"success": True}


# Scripts routes
@router.get("/{project_id}/scripts")
async def list_scripts(project_id: str, db: Session = Depends(get_db)):
    """List all scripts for a project."""
    scripts = db.query(Script).filter(Script.project_id == project_id).order_by(Script.slide_index).all()
    return [s.to_dict() for s in scripts]


@router.post("/{project_id}/scripts", status_code=201)
async def create_script(
    project_id: str, script: ScriptCreate, db: Session = Depends(get_db)
):
    """Create a script for a project."""
    now = int(time.time() * 1000)
    new_script = Script(
        id=str(uuid.uuid4()),
        project_id=project_id,
        slide_id=script.slide_id,
        slide_index=script.slide_index,
        text=script.text,
        speaker_notes=script.speaker_notes,
        estimated_duration=script.estimated_duration,
        created_at=now,
        updated_at=now,
    )
    db.add(new_script)
    db.commit()
    db.refresh(new_script)
    return new_script.to_dict()


@router.patch("/{project_id}/scripts/{script_id}")
async def update_script(
    project_id: str, script_id: str, updates: ScriptUpdate, db: Session = Depends(get_db)
):
    """Update a script."""
    script = db.query(Script).filter(Script.id == script_id, Script.project_id == project_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(script, key, value)
    script.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(script)
    return script.to_dict()


# Recordings routes
@router.get("/{project_id}/recordings")
async def list_recordings(project_id: str, db: Session = Depends(get_db)):
    """List all recordings for a project."""
    recordings = db.query(Recording).filter(Recording.project_id == project_id).all()
    return [r.to_dict() for r in recordings]


@router.post("/{project_id}/recordings", status_code=201)
async def create_recording(
    project_id: str, recording: RecordingCreate, db: Session = Depends(get_db)
):
    """Create a recording for a project."""
    now = int(time.time() * 1000)
    waveform_json = json.dumps(recording.waveform_data) if recording.waveform_data else None

    new_recording = Recording(
        id=str(uuid.uuid4()),
        project_id=project_id,
        slide_id=recording.slide_id,
        slide_index=recording.slide_index,
        audio_path=recording.audio_path,
        duration=recording.duration,
        waveform_data=waveform_json,
        created_at=now,
    )
    db.add(new_recording)
    db.commit()
    db.refresh(new_recording)
    return new_recording.to_dict()


@router.delete("/{project_id}/recordings/{recording_id}")
async def delete_recording(project_id: str, recording_id: str, db: Session = Depends(get_db)):
    """Delete a recording."""
    recording = db.query(Recording).filter(Recording.id == recording_id, Recording.project_id == project_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    db.delete(recording)
    db.commit()
    return {"success": True}


# Analysis routes
@router.get("/{project_id}/analysis")
async def list_analysis(project_id: str, db: Session = Depends(get_db)):
    """List all analysis results for a project."""
    results = db.query(AnalysisResult).filter(AnalysisResult.project_id == project_id).all()
    return [r.to_dict() for r in results]


@router.post("/{project_id}/analysis", status_code=201)
async def create_analysis(
    project_id: str, analysis: AnalysisCreate, db: Session = Depends(get_db)
):
    """Create analysis results for a recording."""
    now = int(time.time() * 1000)

    new_analysis = AnalysisResult(
        id=str(uuid.uuid4()),
        recording_id=analysis.recording_id,
        project_id=project_id,
        overall_score=analysis.overall_score,
        pronunciation_score=analysis.pronunciation_score,
        fluency_score=analysis.fluency_score,
        confidence_score=analysis.confidence_score,
        naturalness_score=analysis.naturalness_score,
        words_per_minute=analysis.words_per_minute,
        filler_words=json.dumps(analysis.filler_words) if analysis.filler_words else None,
        segments=json.dumps(analysis.segments) if analysis.segments else None,
        recommendations=json.dumps(analysis.recommendations) if analysis.recommendations else None,
        created_at=now,
    )
    db.add(new_analysis)
    db.commit()
    db.refresh(new_analysis)
    return new_analysis.to_dict()


# Video routes
@router.get("/{project_id}/video")
async def list_videos(project_id: str, db: Session = Depends(get_db)):
    """List all videos for a project."""
    videos = db.query(Video).filter(Video.project_id == project_id).all()
    return [v.to_dict() for v in videos]


@router.post("/{project_id}/video", status_code=201)
async def create_video(
    project_id: str, video: VideoCreate, db: Session = Depends(get_db)
):
    """Create a video entry for a project."""
    now = int(time.time() * 1000)
    new_video = Video(
        id=str(uuid.uuid4()),
        project_id=project_id,
        output_path=video.output_path,
        duration=video.duration,
        resolution=video.resolution,
        status=video.status,
        progress=0,
        created_at=now,
        updated_at=now,
    )
    db.add(new_video)
    db.commit()
    db.refresh(new_video)
    return new_video.to_dict()


@router.patch("/{project_id}/video/{video_id}")
async def update_video(
    project_id: str, video_id: str, updates: VideoUpdate, db: Session = Depends(get_db)
):
    """Update a video entry."""
    video = db.query(Video).filter(Video.id == video_id, Video.project_id == project_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(video, key, value)
    video.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(video)
    return video.to_dict()


@router.get("/{project_id}/video/{video_id}/progress")
async def get_video_progress(project_id: str, video_id: str, db: Session = Depends(get_db)):
    """Get video processing progress."""
    video = db.query(Video).filter(Video.id == video_id, Video.project_id == project_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return {
        "id": video.id,
        "status": video.status,
        "progress": video.progress,
        "errorMessage": video.error_message,
    }
