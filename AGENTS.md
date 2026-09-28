<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- GreenCode analysis logic lives in `src/lib/greencode/` (`engine.ts` pure deterministic scoring, `regions.ts` grid dataset, `carbon-intensity.server.ts` provider, `analyze.functions.ts` server fn) — keeps numeric results testable and free of UI/network concerns.
- All carbon/energy numbers must come from documented deterministic formulas in `engine.ts`; never from an LLM or random values, because results are presented as reproducible estimates.
- Results are always labelled "estimated", never presented as measured emissions.
- Analyses are stored in the public `analyses` table keyed by uuid; the dashboard reads the stored `result` JSON so a link stays shareable.
