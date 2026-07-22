export function shellCommandHasSideEffects(command) {
  const value = String(command ?? "").trim();
  if (!value) return false;
  if (/(?:^|\s)(?:\d*>>?|&>)\s*(?:"[^"]+"|'[^']+'|[^\s]+)/u.test(value)) return true;
  if (/(?:^|\s)(?:del|erase|rm|rmdir|move|mv|copy|cp|mkdir|md|touch|set-content|add-content)\b/i.test(value)) return true;
  if (/(?:python|python3|py|node|deno)(?:\.exe)?\b[\s\S]*?(?:open\s*\([^)]*(?:['\"](?:w|a|x|wb|ab)|mode\s*=\s*['\"](?:w|a|x|wb|ab))|write(?:File|Text|Bytes)?(?:Sync)?\s*\(|appendFile(?:Sync)?\s*\()/i.test(value)) return true;
  if (/^\s*pdftotext\b/i.test(value) && !/\s-\s*$/.test(value)) return true;
  return false;
}

export function shellCommandArtifactPaths(command) {
  const value = String(command ?? "");
  const paths = [];
  const add = (candidate) => {
    const path = String(candidate ?? "").trim();
    if (path && !paths.includes(path)) paths.push(path);
  };
  for (const match of value.matchAll(/(?:^|\s)(?:\d*>>?|&>)\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/gu)) {
    add(match[1] ?? match[2] ?? match[3]);
  }
  for (const match of value.matchAll(/\b(?:out|output|target|dest(?:ination)?)\s*=\s*r?["']([^"']+)["']/giu)) add(match[1]);
  for (const match of value.matchAll(/(?:open|writeFile(?:Sync)?|appendFile(?:Sync)?)\s*\(\s*r?["']([^"']+)["']/giu)) add(match[1]);
  if (/^\s*pdftotext\b/i.test(value) && !/\s-\s*$/.test(value)) {
    const quoted = [...value.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    if (quoted.length >= 2) add(quoted.at(-1));
  }
  return paths;
}
