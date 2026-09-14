const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

interface WikipediaPage {
  title: string;
  missing?: boolean;
  extract?: string;
  fullurl?: string;
  pageprops?: {
    "wikibase-shortdesc"?: string;
    wikibase_item?: string;
  };
}

interface WikipediaResponse {
  query?: {
    pages?: WikipediaPage[];
  };
}

export interface ArtistBiography {
  text: string;
  url: string;
  source: "Wikipedia";
  genres: string[];
}

const MUSICIAN_DESCRIPTION =
  /\b(musician|singer|rapper|songwriter|record producer|composer|disc jockey|dj|band|duo|group|collective|musical artist|recording artist)\b/i;

const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

function isArtistPage(page: WikipediaPage): boolean {
  if (page.missing || !page.extract || !page.fullurl) return false;
  const description = page.pageprops?.["wikibase-shortdesc"] ?? "";
  return MUSICIAN_DESCRIPTION.test(`${description} ${page.extract.slice(0, 320)}`);
}

export function selectArtistPage(
  artistName: string,
  pages: WikipediaPage[]
): WikipediaPage | null {
  const wanted = normalizeName(artistName);
  return (
    pages
      .filter(isArtistPage)
      .sort((a, b) => {
        const score = (page: WikipediaPage) => {
          const title = normalizeName(page.title);
          if (title === wanted) return 100;
          if (title.startsWith(`${wanted} `)) return 60;
          if (title.includes(wanted) || wanted.includes(title)) return 30;
          return 0;
        };
        return score(b) - score(a);
      })[0] ?? null
  );
}

async function queryWikipedia(params: Record<string, string>): Promise<WikipediaPage[]> {
  const search = new URLSearchParams({
    action: "query",
    prop: "extracts|pageprops|info",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    inprop: "url",
    format: "json",
    formatversion: "2",
    ...params,
  });
  const response = await fetch(`${WIKIPEDIA_API}?${search}`, {
    headers: {
      "User-Agent": "Omni music discovery/0.1 (artist biography lookup)",
    },
    next: { revalidate: 604800 },
  });
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
  const data = (await response.json()) as WikipediaResponse;
  return data.query?.pages ?? [];
}

async function getArtistGenres(entityId?: string): Promise<string[]> {
  if (!entityId || !/^Q\d+$/.test(entityId)) return [];
  try {
    const query = async (params: Record<string, string>) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({
            action: "wbgetentities", format: "json", ...params,
          })}`, {
            cache: "no-store",
            headers: { "User-Agent": "Omni music discovery/0.1 (artist genre lookup)" },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}`);
          const data = await response.json();
          if (data.error) throw new Error(data.error.info ?? "Wikidata lookup failed");
          return data;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
      throw new Error("Wikidata lookup failed");
    };
    const data = await query({ ids: entityId, props: "claims" });
    const claims = data.entities?.[entityId]?.claims?.P136 ?? [];
    const ids = [...new Set<string>(claims
      .filter((claim: { rank?: string }) => claim.rank !== "deprecated")
      .map((claim: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) =>
        claim.mainsnak?.datavalue?.value?.id)
      .filter((id: unknown): id is string => typeof id === "string" && /^Q\d+$/.test(id)))];
    if (!ids.length) return [];
    const labels = await query({ ids: ids.join("|"), props: "labels", languages: "en" });
    return [...new Set(ids.map((id) => labels.entities?.[id]?.labels?.en?.value)
      .filter((label): label is string => typeof label === "string"))];
  } catch {
    return [];
  }
}

/** Find a short, editorial artist introduction without making details depend on it. */
export async function getArtistBiography(
  artistName: string
): Promise<ArtistBiography | null> {
  try {
    const exactPages = await queryWikipedia({
      titles: artistName,
      redirects: "1",
    });
    let page = selectArtistPage(artistName, exactPages);

    if (!page) {
      const searchPages = await queryWikipedia({
        generator: "search",
        gsrsearch: `\"${artistName}\" musician`,
        gsrnamespace: "0",
        gsrlimit: "6",
      });
      page = selectArtistPage(artistName, searchPages);
    }

    if (!page?.extract || !page.fullurl) return null;
    return {
      text: page.extract,
      url: page.fullurl,
      source: "Wikipedia",
      genres: await getArtistGenres(page.pageprops?.wikibase_item),
    };
  } catch (error) {
    console.warn(`[Wikipedia biography: ${artistName}]`, error);
    return null;
  }
}
