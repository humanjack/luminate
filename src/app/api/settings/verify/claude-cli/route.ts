import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST() {
  try {
    const result = await new Promise<{ valid: boolean; version?: string; error?: string }>((resolve) => {
      const child = spawn("claude", ["--version"], {
        timeout: 10000,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error: any) => {
        if (error.code === "ENOENT") {
          resolve({
            valid: false,
            error: "Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code",
          });
        } else {
          resolve({
            valid: false,
            error: `Failed to run Claude CLI: ${error.message}`,
          });
        }
      });

      child.on("close", (code) => {
        if (code === 0) {
          const version = stdout.trim() || "Unknown version";
          resolve({
            valid: true,
            version,
          });
        } else {
          resolve({
            valid: false,
            error: stderr || "Claude CLI exited with an error",
          });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          valid: false,
          error: "Claude CLI check timed out",
        });
      }, 10000);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      valid: false,
      error: `Failed to verify Claude CLI: ${error.message}`,
    });
  }
}
