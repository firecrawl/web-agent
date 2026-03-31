import { listBashFiles, readBashFile } from "@agent-core";

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
