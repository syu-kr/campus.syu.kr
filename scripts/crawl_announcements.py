# -*- coding: utf-8 -*-
"""학사공지 크롤링 스크립트."""

import io
import sys

from crawler_utils import NoticeCrawlerConfig, crawl_notice_board, require_env

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def crawl_academic_notice():
    crawl_notice_board(
        NoticeCrawlerConfig(
            category="academic",
            label="학사공지",
            base_url=require_env("CRAWL_ACADEMIC_NOTICES_URL"),
            output_path="public/data/announcements-academic.json",
            default_author="삼육대학교",
            max_pages=256,
        )
    )


if __name__ == "__main__":
    crawl_academic_notice()
