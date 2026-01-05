const express = require("express");
const axios = require("axios");
const iconv = require("iconv-lite");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

//source_name(뉴스 DB 값)
const SOURCE_TO_PRESS_KEY = {
  동아일보: "동아일보",
  매일경제: "매일경제",
  "매일 경제": "매일경제",
  "Sbs 뉴스": "sbs",
  SBS: "sbs",
  Sbs: "sbs",
  스포츠조선: "스포츠조선",
  Mbn: "Mbn",
  mbn: "Mbn",
  오마이뉴스: "ohmynews",
  Ohmynews: "ohmynews",
  이투데이: "이투데이",
  Chosun: "Chosun",
  Hani: "한겨례",
};

//언론사별 본문 셀렉터 정의
const PRESS_SELECTORS = {
  동아일보: ".news_view",
  매일경제: 'div.news_cnt_detail_wrap[itemprop="articleBody"]',
  sbs: "div.text_area, div#viewer_area, div.article-body, section.text_area",
  Mbn: 'div.detail#newsViewArea[itemprop="articleBody"]',
  ohmynews: 'div.text[itemprop="articleBody"]',
  이투데이: "div.articleView",
  스포츠조선: "div.news_text",
  Chosun: ".article-body",
  한겨례: "div.article-text p.text",
};

//본문 크롤링 함수
async function fetchArticleBody(url, selector, press = "") {
  const { data: buf } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "ko,en;q=0.9",
      Referer: url,
    },
    responseType: "arraybuffer",
    transformResponse: [(b) => b],
  });

  const html = iconv.decode(buf, "utf-8");
  const $ = cheerio.load(html);

  let content = "";

  // Hani(한겨레)
  if (press === "Hani" || press === "한겨례") {
    const paragraphs = $(selector);
    content = paragraphs
      .map((i, el) => $(el).text().trim())
      .get()
      .join("\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (!content || content.length < 30) {
      const $body = $(selector);
      content = $body.text().trim();
    }
  } else {
    const $body = $(selector);
    if ($body.length) {
      content = $body
        .html()
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{2,}/g, "\n")
        .replace(/^\s+|\s+$/gm, "")
        .trim();
    } else {
      content = $(".text_area").text().trim();
    }
  }
  return content;
}

app.get("/scrape", async (req, res) => {
  const { source_name, url } = req.query;

  if (!source_name || !url) {
    return res.status(400).json({ error: "source_name과 url이 필요합니다." });
  }

  const pressKey = SOURCE_TO_PRESS_KEY[source_name];
  const selector = PRESS_SELECTORS[pressKey];

  console.log("[scrape]", { source_name, pressKey, selector, url });

  if (!selector) {
    return res.status(400).json({ error: "지원하지 않는 언론사입니다." });
  }

  try {
    const content = await fetchArticleBody(url, selector, pressKey);

    if (!content) {
      return res.status(404).json({ error: "본문을 찾을 수 없습니다." });
    }

    console.log("[scrape] 본문 길이:", content.length);
    const htmlContent = content.replace(/\n/g, "  ");
    return res.json({ htmlContent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch data" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
