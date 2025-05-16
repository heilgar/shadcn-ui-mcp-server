import * as cheerio from "cheerio";

type Block = {
    name: string;
    command: string;
    code: string;
}

export async function parseBlocksFromPage(url: string): Promise<Block[]> {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
  
    const blocks: Block[] = [];
  
    $("main .content-wrapper > div").each((_, el) => {
      // Block name from anchor
      const anchor = $(el).find('a[href^="#"]');
      const name = anchor.attr("href")?.replace("#", "") || "";
  
      // Command from span (e.g. npx shadcn add ...)
      const command = $(el).find('span.hidden.lg\\:inline').text().trim();
  
      // Code from code block
      const code = $(el).find("code").text().trim();
  
      if (name && command && code) {
        blocks.push({ name, command, code });
      }
    });
  
    return blocks;
  }

export function parseComponentsFromHtml(html: string): string[] {
    const $ = cheerio.load(html);
    const components = $('a[href^="/docs/components/"]')
        .map((_, el) => {
            const href = $(el).attr('href');
            return href?.split('/').pop();
        })
        .get()
        .filter(Boolean)
        .sort();
    return components;
}