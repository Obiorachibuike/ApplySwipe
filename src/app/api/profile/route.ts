import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      include: {
        skills: true,
        experiences: true,
        educations: true,
        projects: true,
        certifications: true,
        user: true,
      },
    });

    const preferences = await db.userPreference.findUnique({
      where: { userId: user.id },
    });

    const resumes = await db.resume.findMany({
      where: { userId: user.id },
      include: { versions: true },
    });

    return NextResponse.json({
      profile,
      preferences,
      resumes,
    });
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      headline,
      bio,
      phone,
      country,
      city,
      targetRoles,
      experienceLevel,
      preferredIndustries,
      preferredEmploymentTypes,
      remotePreference,
      minSalary,
      salaryCurrency,
      onboardingCompleted,
      skills,
      experiences,
      educations,
      projects,
      certifications,
    } = body;

    const existingProfile = await db.profile.findUnique({
      where: { userId: user.id },
    });

    let profileId = existingProfile?.id;

    if (existingProfile) {
      await db.profile.update({
        where: { id: existingProfile.id },
        data: {
          headline: headline !== undefined ? headline : existingProfile.headline,
          bio: bio !== undefined ? bio : existingProfile.bio,
          phone: phone !== undefined ? phone : existingProfile.phone,
          country: country !== undefined ? country : existingProfile.country,
          city: city !== undefined ? city : existingProfile.city,
          targetRoles: targetRoles !== undefined ? targetRoles : existingProfile.targetRoles,
          experienceLevel: experienceLevel !== undefined ? experienceLevel : existingProfile.experienceLevel,
          preferredIndustries: preferredIndustries !== undefined ? preferredIndustries : existingProfile.preferredIndustries,
          preferredEmploymentTypes: preferredEmploymentTypes !== undefined ? preferredEmploymentTypes : existingProfile.preferredEmploymentTypes,
          remotePreference: remotePreference !== undefined ? remotePreference : existingProfile.remotePreference,
          minSalary: minSalary !== undefined ? minSalary : existingProfile.minSalary,
          salaryCurrency: salaryCurrency || existingProfile.salaryCurrency,
          onboardingCompleted: onboardingCompleted !== undefined ? onboardingCompleted : existingProfile.onboardingCompleted,
        },
      });
    } else {
      const newProf = await db.profile.create({
        data: {
          userId: user.id,
          headline,
          bio,
          phone,
          country,
          city,
          targetRoles: targetRoles || [],
          experienceLevel,
          preferredIndustries: preferredIndustries || [],
          preferredEmploymentTypes: preferredEmploymentTypes || ["Full-time"],
          remotePreference: remotePreference || "Remote",
          minSalary,
          salaryCurrency: salaryCurrency || "USD",
          onboardingCompleted: onboardingCompleted ?? true,
        },
      });
      profileId = newProf.id;
    }

    // Update Skills if provided
    if (skills && Array.isArray(skills)) {
      await db.skill.deleteMany({ where: { profileId } });
      for (const s of skills) {
        await db.skill.create({
          data: {
            profileId,
            name: s.name,
            category: s.category || "General",
            yearsExperience: s.yearsExperience || 2,
            level: s.level || "INTERMEDIATE",
          },
        });
      }
    }

    // Update Experiences if provided
    if (experiences && Array.isArray(experiences)) {
      await db.experience.deleteMany({ where: { profileId } });
      for (const e of experiences) {
        await db.experience.create({
          data: {
            profileId,
            company: e.company,
            role: e.role,
            location: e.location || null,
            isCurrent: Boolean(e.isCurrent),
            startDate: e.startDate || new Date().toISOString(),
            endDate: e.endDate || null,
            description: e.description || "",
            achievements: e.achievements || [],
            technologies: e.technologies || [],
          },
        });
      }
    }

    // Update Educations if provided
    if (educations && Array.isArray(educations)) {
      await db.education.deleteMany({ where: { profileId } });
      for (const ed of educations) {
        await db.education.create({
          data: {
            profileId,
            institution: ed.institution,
            degree: ed.degree,
            field: ed.field,
            startYear: Number(ed.startYear) || 2018,
            endYear: ed.endYear ? Number(ed.endYear) : null,
            gpa: ed.gpa || null,
          },
        });
      }
    }

    // Update Projects if provided
    if (projects && Array.isArray(projects)) {
      await db.project.deleteMany({ where: { profileId } });
      for (const p of projects) {
        await db.project.create({
          data: {
            profileId,
            name: p.name,
            description: p.description,
            technologies: p.technologies || [],
            url: p.url || null,
            githubUrl: p.githubUrl || null,
            highlights: p.highlights || [],
          },
        });
      }
    }

    // Update Certifications if provided
    if (certifications && Array.isArray(certifications)) {
      await db.certification.deleteMany({ where: { profileId } });
      for (const c of certifications) {
        await db.certification.create({
          data: {
            profileId,
            name: c.name,
            issuer: c.issuer,
            issueDate: c.issueDate || null,
            expiryDate: c.expiryDate || null,
            credentialId: c.credentialId || null,
            credentialUrl: c.credentialUrl || null,
          },
        });
      }
    }

    const updatedProfile = await db.profile.findUnique({
      where: { id: profileId },
      include: {
        skills: true,
        experiences: true,
        educations: true,
        projects: true,
        certifications: true,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
