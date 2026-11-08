// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isUispImageUrl, parseUispNotice } from "./uisp-notice-parser";

const editorImage = "http://uisp-origin.example.invalid/data/editor/2611/thumb-notice_835x1181.jpg";
const universityImage = "https://www.syu.ac.kr/wp-content/uploads/2026/11/%EA%B3%B5%EC%A7%80.jpg";

describe("UISP notice parser", () => {
  it("keeps an image-only body and resolves only matching GnuBoard file entries", () => {
    const notice = parseUispNotice(`
      <nav><a href="download.php?bo_table=notice&amp;wr_id=743&amp;no=9">menu</a></nav>
      <article>
        <div id="bo_v_con"><p><a href="/bbs/view_image.php?fn=%2Fdata%2Feditor%2Fimage.jpg"><img src="${editorImage}" alt="모집 포스터"></a></p></div>
        <section id="bo_v_file">
          <a href="./download.php?bo_table=notice&amp;wr_id=743&amp;no=0"><strong>붙임 1. 안내 &amp; 공고문.pdf</strong></a>
          <a href="/bbs/download.php?bo_table=notice&amp;wr_id=743&amp;no=1">참가신청서.hwpx</a>
          <a href="/bbs/download.php?bo_table=notice&amp;wr_id=743&amp;no=0">Duplicate</a>
          <a href="/bbs/download.php?bo_table=notice&amp;wr_id=744&amp;no=2">Wrong post</a>
          <a href="/bbs/download.php?bo_table=notice&amp;wr_id=743&amp;no=3&amp;no=2">Duplicate parameter</a>
          <a href="/bbs/download.php?bo_table=private&amp;wr_id=743&amp;no=4">Private board</a>
          <a href="http://uisp-origin.example.invalid.evil.test/bbs/download.php?bo_table=notice&amp;wr_id=743&amp;no=5">Wrong host</a>
        </section>
      </article>`, "743");
    expect(notice?.images).toEqual([editorImage]);
    expect(notice?.content).toEqual([{
      type: "element",
      tag: "p",
      children: [{ type: "image", src: "/api/uisp-assets/uisp-743/image/0", alt: "모집 포스터" }],
    }]);
    expect(notice?.attachments).toEqual([
      { index: "0", name: "붙임 1. 안내 & 공고문.pdf" },
      { index: "1", name: "참가신청서.hwpx" },
    ]);
  });

  it("preserves text, table structure and HTTPS links without active HTML or untrusted URLs", () => {
    const notice = parseUispNotice(`
      <div id="bo_v_con" onclick="alert(1)">
        <p><b>신청 &amp; 안내</b><br><a href="https://naver.me/Example">신청 폼</a>
        <a href="javas&#x63;ript:alert(1)">링크 텍스트</a></p>
        <script>script secret</script><form action="/bbs/write.php">form text</form>
        <template><p>template text</p></template><svg><text>svg text</text></svg>
        <img src="${universityImage}" onerror="alert(1)" alt="포스터">
        <img src="${universityImage}" alt="같은 포스터">
        <img src="https://evil.test/image.jpg" alt="remote">
        <img src="/data/editor/2611/notice.svg" alt="vector">
        <img src="/data/editor/2611/%2fetc.jpg" alt="encoded slash">
        <img src="/data/editor/2611/notice.jpg?redirect=evil" alt="query">
        <table><tr><td>모집 대상</td></tr></table>
      </div>`, "744");
    expect(notice?.images).toEqual([universityImage]);
    expect(JSON.stringify(notice?.content)).toContain('"href":"https://naver.me/Example"');
    expect(JSON.stringify(notice?.content)).toContain('"tag":"tbody"');
    expect(JSON.stringify(notice?.content)).toContain("신청 & 안내");
    expect(JSON.stringify(notice?.content)).toContain("링크 텍스트");
    expect(JSON.stringify(notice?.content)).not.toMatch(/secret|form text|template text|svg text|javascript|alert|remote|vector|encoded slash|query/);
  });

  it("does not treat a login or an invalid requested post as a notice", () => {
    expect(parseUispNotice('<form><p id="bo_v_con">로그인</p></form>', "743")).toBeNull();
    expect(parseUispNotice('<div id="bo_v_con">안내</div>', "743&bo_table=secret")).toBeNull();
    expect(parseUispNotice('<div id="bo_v_con">안내</div>' + " ".repeat(512 * 1024), "743")).toBeNull();
  });

  it("bounds download names without losing the extension", () => {
    const name = "첨부".repeat(100) + ".hwpx";
    const notice = parseUispNotice(`
      <div id="bo_v_con">안내</div>
      <section id="bo_v_file">
        <a href="/bbs/download.php?bo_table=notice&amp;wr_id=743&amp;no=0">${name}</a>
      </section>`, "743");
    const attachment = notice?.attachments[0];
    expect(attachment?.name).toHaveLength(160);
    expect(attachment?.name.endsWith(".hwpx")).toBe(true);
  });

  it.each([
    "http://uisp-origin.example.invalid/data/file/notice/hidden.jpg",
    "http://uisp-origin.example.invalid/data/editor/../file/notice/hidden.jpg",
    "http://uisp-origin.example.invalid/data/editor/2611/private%2fhidden.jpg",
    "http://uisp-origin.example.invalid:8080/data/editor/2611/notice.jpg",
    "https://www.syu.ac.kr/wp-admin/notice.jpg",
    "https://www.syu.ac.kr/wp-content/uploads/2026/11/notice.jpg#external",
    "https://www.syu.ac.kr.evil.test/wp-content/uploads/2026/11/notice.jpg",
  ])("rejects image URL %s outside the fixed raster scopes", (url) => {
    expect(isUispImageUrl(url)).toBe(false);
  });

  it("allows the UISP editor and university uploads image paths", () => {
    expect(isUispImageUrl(editorImage)).toBe(true);
    expect(isUispImageUrl(universityImage)).toBe(true);
  });
});
