import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { useToast } from '@/components/ui/use-toast.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { deleteAdminGuestUsers, getAdminUsersSnapshot, cleanupStaleAttempts } from '@/api/api.js';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';

const computeInactiveDays = (user) => {
  const lastActive = user?.lastActiveAt || user?.createdAt;
  if (!lastActive) return Number.POSITIVE_INFINITY;
  const elapsedMs = Date.now() - new Date(lastActive).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
};

const formatDateValue = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const DevUsersDashboard = () => {
  const { isDevFeaturesEnabled } = useAuth();
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCleaningAttempts, setIsCleaningAttempts] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState(null);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [users, setUsers] = useState([]);
  const [inactiveDaysThreshold, setInactiveDaysThreshold] = useState(30);
  const [showOnlyInactiveGuests, setShowOnlyInactiveGuests] = useState(true);
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getAdminUsersSnapshot();
      setUsers(Array.isArray(snapshot) ? snapshot : []);
      setUsersLoadError(null);
      setShowRefreshPrompt(false);
    } catch (error) {
      setUsersLoadError(error);
      toast({
        title: 'Failed to load users',
        description: getUserFriendlyErrorMessage(error, 'Could not fetch users snapshot.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setSelectedGuestIds((previous) =>
      previous.filter((userId) => users.some((user) => user.id === userId && user.isGuest))
    );
  }, [users]);

  if (!isDevFeaturesEnabled) {
    return <Navigate to="/courses" replace />;
  }

  const handleCleanupAttempts = async () => {
    setIsCleaningAttempts(true);
    try {
      // Direct API call since we are in a dev dashboard and want simple feedback
      const result = await cleanupStaleAttempts();
      toast({
        title: 'Cleanup successful',
        description: `Deleted ${result.deletedCount} stale 'in_progress' attempts (older than 1h).`,
      });
      setShowRefreshPrompt(true);
    } catch (error) {
      toast({
        title: 'Cleanup failed',
        description: getUserFriendlyErrorMessage(error, 'Failed to cleanup attempts.'),
        variant: 'destructive',
      });
    } finally {
      setIsCleaningAttempts(false);
    }
  };

  const guests = users.filter((user) => user.isGuest);
  const inactiveGuests = guests.filter((user) => computeInactiveDays(user) > Number(inactiveDaysThreshold || 0));
  const displayedGuests = showOnlyInactiveGuests ? inactiveGuests : guests;

  const selectedDisplayedGuestIds = useMemo(
    () => displayedGuests.filter((guest) => selectedGuestIds.includes(guest.id)).map((guest) => guest.id),
    [displayedGuests, selectedGuestIds]
  );

  const areAllDisplayedGuestsSelected =
    displayedGuests.length > 0 && selectedDisplayedGuestIds.length === displayedGuests.length;

  const toggleGuestSelection = (guestId) => {
    setSelectedGuestIds((previous) => {
      if (previous.includes(guestId)) {
        return previous.filter((id) => id !== guestId);
      }
      return [...previous, guestId];
    });
  };

  const toggleSelectAllDisplayedGuests = () => {
    if (areAllDisplayedGuestsSelected) {
      setSelectedGuestIds((previous) => previous.filter((id) => !displayedGuests.some((guest) => guest.id === id)));
      return;
    }

    const displayedIds = displayedGuests.map((guest) => guest.id);
    setSelectedGuestIds((previous) => Array.from(new Set([...previous, ...displayedIds])));
  };

  const handleDeleteSelectedGuests = async () => {
    if (selectedGuestIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedGuestIds.length} selected guest user(s) and all linked attempts? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const result = await deleteAdminGuestUsers(selectedGuestIds);
      setSelectedGuestIds([]);
      await loadUsers();
      setShowRefreshPrompt(true);
      toast({
        title: 'Guest cleanup completed',
        description: `Deleted ${result.deletedUsers} guests, ${result.deletedAttempts} attempts, and ${result.deletedAnswers} answers.`,
      });
    } catch (error) {
      toast({
        title: 'Guest cleanup failed',
        description: getUserFriendlyErrorMessage(error, 'Could not delete selected guests.'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Dev Users Dashboard - QuizMaster</title>
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dev Users Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Inspect all users, filter inactive guests (email is missing), and clean up guest accounts with linked
                attempts.
              </p>
            </div>
            {showRefreshPrompt ? (
              <Button type="button" variant="outline" onClick={loadUsers}>
                Refresh Data
              </Button>
            ) : null}
          </div>

          <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900 dark:text-amber-200">Developer mode only</CardTitle>
              <CardDescription className="text-amber-800 dark:text-amber-300">
                Use this page to manage guest accounts (email is null) and clean up stale guest data.
              </CardDescription>
            </CardHeader>
          </Card>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading users...</p>
            </div>
          ) : (
            <DataStatusOverlay
              isVisible={Boolean(usersLoadError)}
              title={isConnectionRelatedError(usersLoadError) ? 'Connection issue' : 'Unable to load users'}
              description={getUserFriendlyErrorMessage(usersLoadError, 'User objects were not loaded.')}
              onRetry={loadUsers}
            >
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total users</CardDescription>
                    <CardTitle>{users.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Guest users</CardDescription>
                    <CardTitle>{guests.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Inactive guests ({inactiveDaysThreshold}+ days)</CardDescription>
                    <CardTitle>{inactiveGuests.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-indigo-600 dark:text-indigo-400 font-medium">System Utilities</CardDescription>
                    <div className="mt-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-xs h-8 border-indigo-200 hover:bg-indigo-100 dark:border-indigo-800 dark:hover:bg-indigo-900/50"
                        onClick={handleCleanupAttempts}
                        disabled={isCleaningAttempts}
                      >
                        {isCleaningAttempts ? 'Cleaning...' : 'Clean Stale Attempts'}
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Guest Cleanup</CardTitle>
                  <CardDescription>
                    Select guest users (email is missing) and delete them together with their linked attempts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label htmlFor="inactiveDays">Inactive days threshold</Label>
                      <Input
                        id="inactiveDays"
                        type="number"
                        min="1"
                        value={inactiveDaysThreshold}
                        onChange={(event) => setInactiveDaysThreshold(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={showOnlyInactiveGuests}
                          onChange={(event) => setShowOnlyInactiveGuests(event.target.checked)}
                        />
                        Show only inactive guests
                      </label>
                    </div>
                    <div className="flex items-end justify-start md:justify-end">
                      <Button
                        variant="destructive"
                        disabled={isDeleting || selectedGuestIds.length === 0}
                        onClick={handleDeleteSelectedGuests}
                      >
                        {isDeleting ? 'Deleting guests...' : `Delete selected guests (${selectedGuestIds.length})`}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-300 dark:border-slate-800">
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                          <tr className="text-left">
                            <th className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={areAllDisplayedGuestsSelected}
                                onChange={toggleSelectAllDisplayedGuests}
                                disabled={displayedGuests.length === 0}
                              />
                            </th>
                            <th className="px-3 py-2">Display Name</th>
                            <th className="px-3 py-2">User ID</th>
                            <th className="px-3 py-2">Attempts</th>
                            <th className="px-3 py-2">Last Active</th>
                            <th className="px-3 py-2">Inactive (days)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedGuests.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                                No guest users match the current filters.
                              </td>
                            </tr>
                          ) : (
                            displayedGuests.map((guest) => (
                              <tr key={guest.id} className="border-t border-slate-200 dark:border-slate-800">
                                <td className="px-3 py-2 align-top">
                                  <input
                                    type="checkbox"
                                    checked={selectedGuestIds.includes(guest.id)}
                                    onChange={() => toggleGuestSelection(guest.id)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">{guest.displayName}</td>
                                <td className="px-3 py-2 align-top font-mono text-xs">{guest.id}</td>
                                <td className="px-3 py-2 align-top">{guest.attemptCount}</td>
                                <td className="px-3 py-2 align-top">{formatDateValue(guest.lastActiveAt || guest.createdAt)}</td>
                                <td className="px-3 py-2 align-top">{computeInactiveDays(guest)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>
                    Includes registered and guest accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {users.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-slate-300 p-3 text-sm dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{entry.displayName}</strong>
                        <Badge variant="outline">{entry.isGuest ? 'Guest' : 'Registered'}</Badge>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{entry.id}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {entry.isGuest ? 'No email (guest)' : entry.email} | attempts: {entry.attemptCount} | last active:{' '}
                        {formatDateValue(entry.lastActiveAt || entry.createdAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </DataStatusOverlay>
          )}
        </div>
      </div>
    </>
  );
};

export default DevUsersDashboard;
