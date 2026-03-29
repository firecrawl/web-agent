import { listBashFiles, readBashFile } from "@/lib/agents/bash-tool";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  if (path) {
    const content = await readBashFile(path);
    return Response.json({ path, content });
  }

  const files = await listBashFiles();
  return Response.json({ files });
}
