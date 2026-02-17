import React, { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';

const FOOTER_CONTENT_KEY = 'quizmaster_footer_content_v1';

const DEFAULT_FOOTER_CONTENT = {
  title: 'QuizMaster',
  subtitle: 'Build mastery one quiz at a time.',
  note: `© ${new Date().getFullYear()} QuizMaster. All rights reserved.`,
};

const readFooterContent = () => {
  try {
    const raw = localStorage.getItem(FOOTER_CONTENT_KEY);
    if (!raw) return DEFAULT_FOOTER_CONTENT;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_FOOTER_CONTENT;

    return {
      title: String(parsed.title || DEFAULT_FOOTER_CONTENT.title),
      subtitle: String(parsed.subtitle || DEFAULT_FOOTER_CONTENT.subtitle),
      note: String(parsed.note || DEFAULT_FOOTER_CONTENT.note),
    };
  } catch {
    return DEFAULT_FOOTER_CONTENT;
  }
};

const writeFooterContent = (content) => {
  localStorage.setItem(FOOTER_CONTENT_KEY, JSON.stringify(content));
};

const SiteFooter = () => {
  const { isDevFeaturesEnabled } = useAuth();
  const [content, setContent] = useState(() => readFooterContent());
  const [draft, setDraft] = useState(() => readFooterContent());

  const hasDraftChanges = useMemo(
    () =>
      draft.title !== content.title ||
      draft.subtitle !== content.subtitle ||
      draft.note !== content.note,
    [content, draft]
  );

  const applyDraft = () => {
    const nextContent = {
      title: draft.title.trim() || DEFAULT_FOOTER_CONTENT.title,
      subtitle: draft.subtitle.trim() || DEFAULT_FOOTER_CONTENT.subtitle,
      note: draft.note.trim() || DEFAULT_FOOTER_CONTENT.note,
    };
    setContent(nextContent);
    setDraft(nextContent);
    writeFooterContent(nextContent);
  };

  const resetContent = () => {
    setContent(DEFAULT_FOOTER_CONTENT);
    setDraft(DEFAULT_FOOTER_CONTENT);
    writeFooterContent(DEFAULT_FOOTER_CONTENT);
  };

  return (
    <footer className="border-t border-slate-300 bg-slate-100/50 backdrop-blur-xl mt-12 dark:border-slate-800/50 dark:bg-slate-950">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:flex md:items-center md:justify-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{content.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{content.subtitle}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">{content.note}</p>
        </div>

        {isDevFeaturesEnabled && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Footer Customization (Dev Mode)</p>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Footer title"
            />
            <Input
              value={draft.subtitle}
              onChange={(e) => setDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Footer subtitle"
            />
            <textarea
              value={draft.note}
              onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Footer note"
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={applyDraft} disabled={!hasDraftChanges}>
                Save Footer
              </Button>
              <Button variant="outline" onClick={resetContent}>
                Reset Default
              </Button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

export default SiteFooter;
