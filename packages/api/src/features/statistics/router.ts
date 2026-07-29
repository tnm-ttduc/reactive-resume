import z from "zod";
import { publicProcedure } from "../../context";
import { statisticsService } from "./service";

const userRouter = {
	getCount: publicProcedure
		.route({
			method: "GET",
			path: "/statistics/users",
			tags: ["Platform Statistics"],
			operationId: "getUserCount",
			summary: "Get total number of users",
			description:
				"Returns the total number of registered users on this TNM HR Platform instance. The count is cached for up to 6 hours for performance. No authentication required.",
			successDescription: "The total number of registered users.",
		})
		.output(z.number().describe("The total number of registered users."))
		.handler(async (): Promise<number> => {
			return await statisticsService.user.getCount();
		}),
};

const resumeRouter = {
	getCount: publicProcedure
		.route({
			method: "GET",
			path: "/statistics/resumes",
			tags: ["Platform Statistics"],
			operationId: "getResumeCount",
			summary: "Get total number of resumes",
			description:
				"Returns the total number of resumes created on this TNM HR Platform instance. The count is cached for up to 6 hours for performance. No authentication required.",
			successDescription: "The total number of resumes created.",
		})
		.output(z.number().describe("The total number of resumes created."))
		.handler(async (): Promise<number> => {
			return await statisticsService.resume.getCount();
		}),
};

export const statisticsRouter = {
	user: userRouter,
	resume: resumeRouter,
};
