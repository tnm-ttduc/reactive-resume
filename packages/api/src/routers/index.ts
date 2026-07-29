import { agentRouter } from "../features/agent/router";
import { aiRouter } from "../features/ai/router";
import { aiProvidersRouter } from "../features/ai-providers/router";
import { applicationsRouter } from "../features/applications/router";
import { authRouter } from "../features/auth/router";
import { candidatesRouter } from "../features/candidates/router";
import { customTemplatesRouter } from "../features/custom-templates/router";
import { flagsRouter } from "../features/flags/router";
import { resumeRouter } from "../features/resume/router";
import { statisticsRouter } from "../features/statistics/router";
import { storageRouter } from "../features/storage/router";

export default {
	ai: aiRouter,
	aiProviders: aiProvidersRouter,
	agent: agentRouter,
	applications: applicationsRouter,
	auth: authRouter,
	candidates: candidatesRouter,
	customTemplates: customTemplatesRouter,
	flags: flagsRouter,
	resume: resumeRouter,
	statistics: statisticsRouter,
	storage: storageRouter,
};
