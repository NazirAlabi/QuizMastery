import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useToast } from '@/components/ui/use-toast.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { getFeedbackEntries, updateFeedbackEntry } from '@/api/api.js';
import { FEEDBACK_CATEGORY_OPTIONS, FEEDBACK_URGENCY_OPTIONS } from '@/config/feedbackPresets.js';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';

const STATUS_OPTIONS = ['new', 'triaged', 'in_progress', 'resolved', 'dismissed'];

const formatTimestamp = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const DevFeedbackDashboard = () => {
  const { isDevFeaturesEnabled } = useAuth();
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingId, setIsSavingId] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [draftMap, setDraftMap] = useState({});

  const loadFeedback = async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const entries = await getFeedbackEntries();
      setFeedbackEntries(entries);
      setLoadError(null);
      setDraftMap(
        entries.reduce((acc, entry) => {
          acc[entry.id] = {
            status: entry.status || 'new',
            category: entry.category || '',
            tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : '',
            triageNotes: String(entry.triageNotes || ''),
          };
          return acc;
        }, {})
      );
    } catch (error) {
      setLoadError(error);
      toast({
        title: 'Failed to load feedback',
        description: getUserFriendlyErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      if (silent) setIsRefreshing(false);
      else setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return feedbackEntries.filter((entry) => {
      if (statusFilter && entry.status !== statusFilter) return false;
      if (categoryFilter && entry.category !== categoryFilter) return false;
      if (urgencyFilter && entry.urgency !== urgencyFilter) return false;

      if (!normalizedSearch) return true;
      const haystack = [
        entry.reason,
        entry.subject,
        entry.details,
        entry.contextLabel,
        entry.contextKey,
        entry.subjectType,
        entry.subjectId,
        entry.user?.email,
        entry.user?.displayName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [categoryFilter, feedbackEntries, search, statusFilter, urgencyFilter]);

  const saveEntry = async (entryId) => {
    const draft = draftMap[entryId];
    if (!draft) return;

    setIsSavingId(entryId);
    try {
      await updateFeedbackEntry(entryId, {
        status: draft.status || 'new',
        category: draft.category || null,
        tags: String(draft.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        triageNotes: String(draft.triageNotes || '').trim() || null,
      });
      toast({
        title: 'Feedback updated',
        description: 'Categorization changes were saved.',
      });
      await loadFeedback({ silent: true });
    } catch (error) {
      toast({
        title: 'Failed to update feedback',
        description: getUserFriendlyErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingId('');
    }
  };

  if (!isDevFeaturesEnabled) {
    return <Navigate to="/courses" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Dev Feedback Dashboard - QuizMaster</title>
      </Helmet>
      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dev Feedback Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Review user feedback across the site and triage by status/category.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => loadFeedback({ silent: true })} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>Find specific feedback quickly.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="feedback-search">Search</Label>
                <Input
                  id="feedback-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reason, details, context, email..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-status-filter">Status</Label>
                <select
                  id="feedback-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-category-filter">Category</Label>
                <select
                  id="feedback-category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All</option>
                  {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback-urgency-filter">Urgency</Label>
                <select
                  id="feedback-urgency-filter"
                  value={urgencyFilter}
                  onChange={(event) => setUrgencyFilter(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">All</option>
                  {FEEDBACK_URGENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading feedback...</p>
            </div>
          ) : (
            <DataStatusOverlay
              isVisible={Boolean(loadError)}
              title={isConnectionRelatedError(loadError) ? 'Connection issue' : 'Unable to load feedback'}
              description={getUserFriendlyErrorMessage(loadError, 'Feedback entries were not loaded.')}
              onRetry={() => loadFeedback({ silent: true })}
            >
            <div className="space-y-4">
              {filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
                    No feedback matches the current filters.
                  </CardContent>
                </Card>
              ) : (
                filteredEntries.map((entry) => {
                  const draft = draftMap[entry.id] || {
                    status: entry.status || 'new',
                    category: entry.category || '',
                    tags: '',
                    triageNotes: '',
                  };

                  return (
                    <Card key={entry.id}>
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{entry.subject || entry.reason || 'Untitled feedback'}</CardTitle>
                          <Badge variant="outline">{entry.status || 'new'}</Badge>
                          {entry.urgency ? <Badge variant="outline">urgency: {entry.urgency}</Badge> : null}
                          {entry.category ? <Badge variant="outline">category: {entry.category}</Badge> : null}
                        </div>
                        <CardDescription>
                          {entry.contextLabel || entry.contextKey || 'General'} | {formatTimestamp(entry.createdAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                          <p><strong>Reason:</strong> {entry.reason || 'N/A'}</p>
                          <p><strong>Details:</strong> {entry.details || 'N/A'}</p>
                          <p><strong>Subject Ref:</strong> {entry.subjectType || 'n/a'} / {entry.subjectId || 'n/a'}</p>
                          <p><strong>From:</strong> {entry.user?.displayName || 'anonymous'} ({entry.user?.email || 'no email'})</p>
                          <p><strong>Page:</strong> {entry.sourcePath || '/'}{entry.sourceSearch || ''}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-1">
                            <Label>Status</Label>
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                setDraftMap((previous) => ({
                                  ...previous,
                                  [entry.id]: { ...draft, status: event.target.value },
                                }))
                              }
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label>Category</Label>
                            <select
                              value={draft.category}
                              onChange={(event) =>
                                setDraftMap((previous) => ({
                                  ...previous,
                                  [entry.id]: { ...draft, category: event.target.value },
                                }))
                              }
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                              <option value="">None</option>
                              {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <Label>Tags (comma separated)</Label>
                            <Input
                              value={draft.tags}
                              onChange={(event) =>
                                setDraftMap((previous) => ({
                                  ...previous,
                                  [entry.id]: { ...draft, tags: event.target.value },
                                }))
                              }
                              placeholder="bug, content, quiz-runner"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Triage notes</Label>
                          <textarea
                            rows={3}
                            value={draft.triageNotes}
                            onChange={(event) =>
                              setDraftMap((previous) => ({
                                ...previous,
                                [entry.id]: { ...draft, triageNotes: event.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={() => saveEntry(entry.id)} disabled={isSavingId === entry.id}>
                            {isSavingId === entry.id ? 'Saving...' : 'Save Categorization'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            </DataStatusOverlay>
          )}
        </div>
      </div>
    </>
  );
};

export default DevFeedbackDashboard;
