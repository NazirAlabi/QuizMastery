import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from '@/App';
import '@/index.css';

const queryClient = new QueryClient({
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
