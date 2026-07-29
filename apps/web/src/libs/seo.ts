const productionRootUrl = "http://localhost:3000/";
const appName = "TNM HR Platform";

type JsonLd = Record<string, unknown>;

export const getCanonicalRootUrl = (origin?: string): string => {
	if (!origin) return productionRootUrl;

	const url = new URL(origin);
	url.pathname = "/";
	url.search = "";
	url.hash = "";

	return url.toString();
};

export const createNoindexFollowMeta = () => ({ name: "robots", content: "noindex, follow" });

type ResumeSocialMetaOptions = {
	canonicalUrl: string;
	title: string;
	description: string;
	imageUrl: string;
};

export const createResumeSocialMeta = ({ canonicalUrl, title, description, imageUrl }: ResumeSocialMetaOptions) => [
	{ property: "og:type", content: "profile" },
	{ property: "og:title", content: title },
	{ property: "og:description", content: description },
	{ property: "og:url", content: canonicalUrl },
	{ property: "og:image", content: imageUrl },
	{ property: "twitter:card", content: "summary_large_image" },
	{ property: "twitter:title", content: title },
	{ property: "twitter:description", content: description },
	{ property: "twitter:image", content: imageUrl },
];

const serializeJsonLdForScript = (data: JsonLd) =>
	JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (character) => {
		switch (character) {
			case "<":
				return "\\u003C";
			case ">":
				return "\\u003E";
			case "&":
				return "\\u0026";
			case "\u2028":
				return "\\u2028";
			case "\u2029":
				return "\\u2029";
			default:
				return character;
		}
	});

const createStructuredDataScript = (id: string, data: JsonLd) => ({
	id,
	type: "application/ld+json",
	children: serializeJsonLdForScript(data),
});

export const getRootStructuredData = (canonicalUrl: string): JsonLd[] => [
	{
		"@type": "WebSite",
		name: appName,
		url: canonicalUrl,
	},
	{
		"@type": ["SoftwareApplication", "WebApplication"],
		name: appName,
		url: canonicalUrl,
		description:
			"Create role-ready resumes, organize job applications, and use AI to make every career move more confident.",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		isAccessibleForFree: true,
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		},
	},
	{
		"@type": "FAQPage",
		mainEntity: homeFaqJsonLdItems.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	},
];

export const createRootStructuredDataScript = (canonicalUrl: string) =>
	createStructuredDataScript("tnm-hr-platform-structured-data", {
		"@context": "https://schema.org",
		"@graph": getRootStructuredData(canonicalUrl),
	});

const homeFaqJsonLdItems = [
	{
		question: "What is TNM HR Platform?",
		answer: "TNM HR Platform helps users create, manage, and share professional resumes from one place.",
	},
	{
		question: "How is my data protected?",
		answer:
			"Your data is stored securely and is never shared with third parties. Your administrator controls how the platform is hosted and operated.",
	},
	{
		question: "Can I export my resume to PDF?",
		answer:
			"Absolutely! You can export your resume to PDF with a single click. The exported PDF maintains all your formatting and styling perfectly.",
	},
	{
		question: "Is TNM HR Platform available in multiple languages?",
		answer: "Yes. You can choose your preferred language in the settings page or from the language switcher.",
	},
	{
		question: "What makes TNM HR Platform useful?",
		answer:
			"It brings resume creation, job application tracking, and AI-assisted workflows into one focused workspace.",
	},
	{
		question: "Can I create different resumes for different roles?",
		answer:
			"Yes. Keep a complete career profile, then create focused resume versions that highlight the most relevant experience for each opportunity.",
	},
	{
		question: "How does AI help with my application?",
		answer:
			"AI can compare your profile with a role, suggest clearer wording, and identify useful skills or experience to highlight. You always review and control the final content.",
	},
	{
		question: "How do I share my resume?",
		answer:
			"You can share your resume via a unique public URL, protect it with a password, or download it as a PDF to share directly. The choice is yours!",
	},
] as const;
