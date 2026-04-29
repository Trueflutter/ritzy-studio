"use server";

import { generateClarifyingQuestions } from "@ritzy-studio/ai";
import { createProjectWithRoomSchema, designBriefSchema } from "@ritzy-studio/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length === 0) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = optionalString(formData, "name");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name
      }
    }
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function createProjectWithRoomAction(formData: FormData) {
  const parsed = createProjectWithRoomSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    clientName: optionalString(formData, "clientName"),
    location: optionalString(formData, "location"),
    budgetMinAed: optionalNumber(formData, "budgetMinAed"),
    budgetMaxAed: optionalNumber(formData, "budgetMaxAed"),
    roomName: String(formData.get("roomName") ?? "").trim(),
    roomType: String(formData.get("roomType") ?? "").trim()
  });

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_user_id: user.id,
      name: parsed.name,
      client_name: parsed.clientName ?? null,
      location: parsed.location ?? null,
      budget_min_aed: parsed.budgetMinAed ?? null,
      budget_max_aed: parsed.budgetMaxAed ?? null,
      status: "active"
    })
    .select("id")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      project_id: project.id,
      name: parsed.roomName,
      room_type: parsed.roomType,
      status: "draft"
    })
    .select("id")
    .single();

  if (roomError) {
    throw new Error(roomError.message);
  }

  revalidatePath("/");
  redirect(`/projects/${project.id}/rooms/${room.id}/photos`);
}

export async function saveDesignBriefAction(formData: FormData) {
  const parsed = designBriefSchema.parse({
    projectId: String(formData.get("projectId") ?? ""),
    roomId: String(formData.get("roomId") ?? ""),
    roomType: String(formData.get("roomType") ?? ""),
    styleNotes: optionalString(formData, "styleNotes"),
    colorNotes: optionalString(formData, "colorNotes"),
    budgetNotes: optionalString(formData, "budgetNotes"),
    functionalRequirements: optionalString(formData, "functionalRequirements"),
    avoidNotes: optionalString(formData, "avoidNotes"),
    inspirationNotes: optionalString(formData, "inspirationNotes"),
    wallLengthCm: optionalNumber(formData, "wallLengthCm"),
    roomDepthCm: optionalNumber(formData, "roomDepthCm"),
    ceilingHeightCm: optionalNumber(formData, "ceilingHeightCm"),
    measurementNotes: optionalString(formData, "measurementNotes")
  });

  const redirectPath = `/projects/${parsed.projectId}/rooms/${parsed.roomId}/brief`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", parsed.roomId)
    .eq("project_id", parsed.projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const hasMeasurements =
    parsed.wallLengthCm !== undefined ||
    parsed.roomDepthCm !== undefined ||
    parsed.ceilingHeightCm !== undefined ||
    parsed.measurementNotes !== undefined;

  const structuredJson = {
    measurements: hasMeasurements
      ? {
          wallLengthCm: parsed.wallLengthCm ?? null,
          roomDepthCm: parsed.roomDepthCm ?? null,
          ceilingHeightCm: parsed.ceilingHeightCm ?? null,
          notes: parsed.measurementNotes ?? null,
          source: "manual",
          confidence: "verified"
        }
      : null
  };

  const { data: existingBrief } = await supabase
    .from("design_briefs")
    .select("id")
    .eq("room_id", parsed.roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const briefPayload = {
    room_id: parsed.roomId,
    style_notes: parsed.styleNotes ?? null,
    color_notes: parsed.colorNotes ?? null,
    budget_notes: parsed.budgetNotes ?? null,
    functional_requirements: parsed.functionalRequirements ?? null,
    avoid_notes: parsed.avoidNotes ?? null,
    inspiration_notes: parsed.inspirationNotes ?? null,
    structured_json: structuredJson
  };

  const briefResult = existingBrief
    ? await supabase
        .from("design_briefs")
        .update(briefPayload)
        .eq("id", existingBrief.id)
        .select("id")
        .single()
    : await supabase.from("design_briefs").insert(briefPayload).select("id").single();

  if (briefResult.error) {
    throw new Error(briefResult.error.message);
  }

  const designBriefId = briefResult.data.id;

  if (hasMeasurements) {
    const { error: measurementError } = await supabase.from("room_measurements").insert({
      room_id: parsed.roomId,
      source: "manual",
      confidence: "verified",
      wall_length_cm: parsed.wallLengthCm ?? null,
      room_depth_cm: parsed.roomDepthCm ?? null,
      ceiling_height_cm: parsed.ceilingHeightCm ?? null,
      notes: parsed.measurementNotes ?? null
    });

    if (measurementError) {
      throw new Error(measurementError.message);
    }
  }

  await supabase.from("rooms").update({ status: "briefing" }).eq("id", parsed.roomId);

  const serviceSupabase = createServiceClient();
  const inputSummary = {
    roomType: parsed.roomType,
    styleNotes: parsed.styleNotes ?? null,
    colorNotes: parsed.colorNotes ?? null,
    budgetNotes: parsed.budgetNotes ?? null,
    hasMeasurements
  };

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      job_type: "clarifying_questions",
      status: "running",
      provider: "openai",
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini",
      prompt_version: null,
      input_summary: inputSummary
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  try {
    const result = await generateClarifyingQuestions({
      roomType: parsed.roomType,
      styleNotes: parsed.styleNotes,
      colorNotes: parsed.colorNotes,
      budgetNotes: parsed.budgetNotes,
      functionalRequirements: parsed.functionalRequirements,
      avoidNotes: parsed.avoidNotes,
      inspirationNotes: parsed.inspirationNotes,
      measurements: hasMeasurements
        ? {
            wallLengthCm: parsed.wallLengthCm,
            roomDepthCm: parsed.roomDepthCm,
            ceilingHeightCm: parsed.ceilingHeightCm,
            notes: parsed.measurementNotes
          }
        : undefined
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        model: result.model,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          questionCount: result.questions.length
        }
      })
      .eq("id", job.id);

    await supabase.from("clarifying_questions").delete().eq("design_brief_id", designBriefId);

    if (result.questions.length > 0) {
      const { error: questionsError } = await supabase.from("clarifying_questions").insert(
        result.questions.map((question) => ({
          design_brief_id: designBriefId,
          question: question.question,
          status: "open" as const
        }))
      );

      if (questionsError) {
        throw new Error(questionsError.message);
      }
    }
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Clarifying question generation failed."
      })
      .eq("id", job.id);

    redirect(`${redirectPath}?message=${encodeURIComponent("Brief saved. Clarifying questions could not be generated yet.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Brief saved. Review any clarifying questions before concepts.")}`);
}

export async function saveClarifyingAnswersAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const updates = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("answer:"))
    .map(([key, value]) => ({
      id: key.replace("answer:", ""),
      answer: String(value ?? "").trim()
    }))
    .filter((update) => update.id.length > 0);

  for (const update of updates) {
    await supabase
      .from("clarifying_questions")
      .update({
        answer: update.answer.length > 0 ? update.answer : null,
        status: update.answer.length > 0 ? "answered" : "open",
        answered_at: update.answer.length > 0 ? new Date().toISOString() : null
      })
      .eq("id", update.id);
  }

  const redirectPath = `/projects/${projectId}/rooms/${roomId}/brief`;
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Clarifying answers saved.")}`);
}
