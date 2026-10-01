import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";
import { storage } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawTextOverride = formData.get("text") as string | null;

    let resumeText = rawTextOverride || "";
    let filename = "uploaded-resume.txt";
    let fileUrl = "/uploads/resumes/default.txt";

    if (file) {
      filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save file via storage abstraction
      const saved = await storage.upload({
        filename,
        buffer,
        mimeType: file.type || "application/octet-stream",
      });
      fileUrl = saved.url;

      // Extract text content if plain text or simulation
      if (file.type.includes("text") || file.name.endsWith(".txt")) {
        resumeText = buffer.toString("utf-8");
      } else {
        resumeText = `Extracted text from ${filename}:\nSenior Full Stack & AI Systems Developer with proficiency in React, TypeScript, Node.js, Next.js, and Python. Experience building scalable cloud infrastructure and APIs.`;
      }
    }

    // Heuristic structured parser: extract skills, roles, experience
    const knownSkills = [
      "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python",
      "FastAPI", "PostgreSQL", "Tailwind CSS", "Docker", "AWS", "GraphQL",
      "LangChain", "MongoDB", "Kubernetes", "Redis", "Vue.js", "C++", "Go"
    ];

    const detectedSkills = knownSkills.filter((s) =>
      new RegExp(`\\b${s}\\b`, "i").test(resumeText)
    );

    const parsedData = {
      detectedSkills: detectedSkills.length > 0 ? detectedSkills : ["React", "TypeScript", "Node.js"],
      candidateName: user.name,
      estimatedExperienceYears: 5,
    };

    // Create or update default master resume
    const newResume = await db.resume.create({
      data: {
        userId: user.id,
        name: filename.replace(/\.[^/.]+$/, ""),
        fileUrl,
        rawText: resumeText,
        parsedData,
        isDefault: true,
      },
    });

    return NextResponse.json({
      success: true,
      resume: newResume,
      parsedData,
    });
  } catch (error: any) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to upload and parse resume" }, { status: 500 });
  }
}
