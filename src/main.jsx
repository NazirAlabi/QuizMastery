import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from '@/App';
import { toast } from '@/components/ui/use-toast.jsx';
import '@/index.css';

const isOfflineError = (error) => {
	if (!window.navigator.onLine) return true;
	
	const errorMessage = String(error?.message || '').toLowerCase();
	if (
		errorMessage.includes('offline') || 
		errorMessage.includes('failed to fetch') || 
		errorMessage.includes('network error') ||
		errorMessage.includes('unavailable')
	) {
		return true;
	}
	
	const errorCode = String(error?.code || '').toLowerCase();
	if (errorCode.includes('unavailable') || errorCode.includes('offline')) {
		return true;
	}

	return false;
};

const handleGlobalError = (error) => {
	if (isOfflineError(error)) {
		toast({
			title: 'Connection Error',
			description: 'Please check your internet connection.',
			variant: 'destructive',
		});
	}
};

const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: handleGlobalError,
	}),
	mutationCache: new MutationCache({
		onError: handleGlobalError,
	}),
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			cacheTime: 10 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
		},
	},
});

if (import.meta.env.DEV) {
	import('@/api/contentUploader.js').then(({ uploadStarterCourses, UPLOAD_MODES }) => {
		window.uqmContentUploader = {
			uploadStarterCourses,
			UPLOAD_MODES,
		};
	});
}

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
			{import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
		</QueryClientProvider>
	</React.StrictMode>
);
