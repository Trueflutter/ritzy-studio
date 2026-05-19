import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DesignBriefPage({
  params
}: {
  params: Promise<{ projectId: string; roomId: string }>;
}) {
  const { projectId, roomId } = await params;
  redirect(`/projects/${projectId}/rooms/${roomId}/brief/style`);
}
