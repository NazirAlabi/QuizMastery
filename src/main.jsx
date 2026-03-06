import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import 'katex/dist/katex.min.css';

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
		<App />
	</React.StrictMode>
);
