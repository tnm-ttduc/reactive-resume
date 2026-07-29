import { customTemplateService } from "./service";

export function readCustomTemplateSource(input: { id: string; userId: string }) {
	return customTemplateService.readSource(input);
}
