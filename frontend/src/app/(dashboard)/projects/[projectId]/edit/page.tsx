import { redirect } from "next/navigation";

export default function EditProjectPage({ params }: { params: { projectId: string } }) {
  redirect("/projects/" + params.projectId);
}
