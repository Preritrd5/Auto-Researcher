from __future__ import annotations

from dataclasses import asdict
from difflib import SequenceMatcher

from app.retrieval.literature_search import LiteratureSearchService, PaperCandidate


class CitationVerifier:
    def __init__(self, search: LiteratureSearchService) -> None:
        self.search = search

    async def verify_titles(self, titles: list[str]) -> list[dict]:
        verified: list[dict] = []
        for title in titles:
            candidate = await self.verify_title(title)
            if candidate:
                payload = asdict(candidate)
                payload["verified"] = True
                verified.append(payload)
        return verified

    async def verify_title(self, title: str) -> PaperCandidate | None:
        options = await self.search.search(title, limit=5)
        if not options:
            return None
        scored = sorted(options, key=lambda item: self.similarity(title, item.title), reverse=True)
        top = scored[0]
        if self.similarity(title, top.title) < 0.6:
            return None
        return top

    @staticmethod
    def similarity(left: str, right: str) -> float:
        return SequenceMatcher(None, left.lower().strip(), right.lower().strip()).ratio()

