import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { X } from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Update your personal information.',
  },
];

const SettingsModal = ({ open, onClose }) => {
  const { user, updateUserDisplayName } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS[0].id);
  const [nameDraft, setNameDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNameDraft(user?.displayName || '');
    }
  }, [open, user?.displayName]);

  useEffect(() => {
    if (!open) return undefined;

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  const hasNameChanged = useMemo(
    () => nameDraft.trim() !== String(user?.displayName || '').trim(),
    [nameDraft, user?.displayName]
  );

  if (!open) return null;

  const handleSaveName = async (event) => {
    event.preventDefault();
    const normalizedName = nameDraft.trim();
    if (!normalizedName) {
      toast({
        title: 'Name required',
        description: 'Please enter a name before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const result = await updateUserDisplayName(normalizedName);
    if (result.success) {
      toast({
        title: 'Settings saved',
        description: 'Your display name has been updated.',
      });
      onClose();
    } else {
      toast({
        title: 'Unable to save',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm md:p-6">
      <div className="flex min-h-full items-start justify-center py-4 md:py-10">
      <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950 md:max-h-[calc(100vh-5rem)]">
        <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Manage your account preferences.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid min-h-[280px] grid-cols-1 overflow-hidden md:grid-cols-[200px_1fr]">
          <aside className="border-b border-slate-300 p-3 md:border-b-0 md:border-r dark:border-slate-800">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  activeSection === section.id
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                {section.title}
              </button>
            ))}
          </aside>

          <section className="overflow-y-auto p-4 md:p-6">
            {activeSection === 'profile' && (
              <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Profile</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Update your display name used across the app.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-name">Display Name</Label>
                  <Input
                    id="settings-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="Your name"
                    maxLength={80}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!hasNameChanged || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SettingsModal;
