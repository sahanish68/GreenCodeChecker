export function parseRepoUrl(input: string): { owner: string; name: string; branch: string | null } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a full public GitHub repository URL, for example https://github.com/vercel/next.js");
  }

  let segments: string[];
  try {
    segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new Error("Enter a full public GitHub repository URL, for example https://github.com/vercel/next.js");
  }
  const validRepoPath = segments.length === 2 || (segments.length === 4 && segments[2] === "tree");
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    !validRepoPath ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\")) ||
    !/^[A-Za-z0-9-]+$/.test(segments[0] ?? "") ||
    !/^[A-Za-z0-9_.-]+$/.test(segments[1] ?? "")
  ) {
    throw new Error("Enter a full public GitHub repository URL, for example https://github.com/vercel/next.js");
  }

  const owner = segments[0]!;
  const name = segments[1]!.replace(/\.git$/i, "");
  const branch = segments.length === 4 ? segments[3]! : null;
  if (!name || name === "." || name === "..") {
    throw new Error("Enter a full public GitHub repository URL, for example https://github.com/vercel/next.js");
  }
  return { owner, name, branch };
}