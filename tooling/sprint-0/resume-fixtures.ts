import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

export type GoldenDatasetName = "short-vi" | "medium-vi" | "long-vi" | "very-long-vi";

const website = { url: "", label: "", inlineLink: false };

function createBaseResume(): ResumeData {
	const data = structuredClone(defaultResumeData);

	data.picture.hidden = true;
	data.basics = {
		name: "Nguyễn Minh Anh",
		headline: "Kỹ sư phần mềm",
		email: "minh.anh@example.com",
		phone: "+84 900 000 000",
		location: "Đà Nẵng, Việt Nam",
		website: { url: "https://example.com", label: "Hồ sơ năng lực" },
		customFields: [],
	};
	data.summary = {
		...data.summary,
		title: "Tóm tắt",
		content:
			"<p>Kỹ sư phần mềm tập trung vào sản phẩm web ổn định, trải nghiệm người dùng rõ ràng và khả năng vận hành lâu dài.</p>",
	};
	data.metadata.page.locale = "vi-VN";
	data.metadata.page.format = "a4";
	data.sections.experience.title = "Kinh nghiệm";
	data.sections.education.title = "Học vấn";
	data.sections.projects.title = "Dự án";
	data.sections.skills.title = "Kỹ năng";
	data.sections.languages.title = "Ngôn ngữ";
	data.sections.certifications.title = "Chứng chỉ";
	data.sections.skills.items = [
		{
			id: "skill-typescript",
			hidden: false,
			icon: "code",
			iconColor: "",
			name: "TypeScript",
			proficiency: "Nâng cao",
			level: 4,
			keywords: ["React", "Node.js", "PostgreSQL"],
		},
		{
			id: "skill-delivery",
			hidden: false,
			icon: "users",
			iconColor: "",
			name: "Phát triển sản phẩm",
			proficiency: "Nâng cao",
			level: 4,
			keywords: ["Discovery", "Kiểm thử", "Vận hành"],
		},
	];
	data.sections.languages.items = [
		{ id: "lang-vi", hidden: false, language: "Tiếng Việt", fluency: "Bản ngữ", level: 5 },
		{ id: "lang-en", hidden: false, language: "Tiếng Anh", fluency: "Làm việc", level: 4 },
	];

	return data;
}

function experience(index: number) {
	return {
		id: `experience-${index}`,
		hidden: false,
		company: `Công ty Công nghệ ${index + 1}`,
		position: index === 0 ? "Kỹ sư phần mềm chính" : "Kỹ sư phần mềm",
		location: index % 2 === 0 ? "Hà Nội" : "Thành phố Hồ Chí Minh",
		period: `${2025 - index} - ${index === 0 ? "Hiện tại" : 2026 - index}`,
		website,
		description:
			"<ul><li>Thiết kế và phát triển tính năng phục vụ quy trình nội bộ.</li><li>Cải thiện độ ổn định, khả năng quan sát và thời gian phản hồi của hệ thống.</li><li>Phối hợp với sản phẩm, QA và vận hành để đưa thay đổi vào sử dụng an toàn.</li></ul>",
		roles: [],
	};
}

function project(index: number) {
	return {
		id: `project-${index}`,
		hidden: false,
		name: `Nền tảng nội bộ ${index + 1}`,
		period: `${2023 + index} - ${2024 + index}`,
		website,
		description:
			"<p>Xây dựng luồng dữ liệu có kiểm soát, giảm thao tác thủ công và hỗ trợ đội ngũ theo dõi kết quả theo thời gian.</p>",
	};
}

export function createGoldenDatasets(): Record<GoldenDatasetName, ResumeData> {
	const short = createBaseResume();

	const medium = createBaseResume();
	medium.sections.experience.items = [experience(0), experience(1)];
	medium.sections.experience.items = medium.sections.experience.items.map((item) => ({
		...item,
		description: "<ul><li>Phát triển tính năng và phối hợp đưa thay đổi vào sử dụng an toàn.</li></ul>",
	}));
	medium.sections.education.items = [
		{
			id: "education-0",
			hidden: false,
			school: "Đại học Bách khoa",
			degree: "Kỹ sư",
			area: "Công nghệ thông tin",
			grade: "",
			location: "Đà Nẵng",
			period: "2015 - 2020",
			website,
			description: "<p>Tập trung vào kỹ nghệ phần mềm và hệ thống thông tin.</p>",
		},
	];
	medium.sections.projects.items = [project(0)];

	const long = createBaseResume();
	long.summary.content =
		"<p>Kỹ sư phần mềm có kinh nghiệm xây dựng sản phẩm web, hệ thống dữ liệu và công cụ vận hành cho nhiều nhóm người dùng. Ưu tiên thiết kế đơn giản, kiểm thử tự động, bảo mật dữ liệu và khả năng bàn giao rõ ràng.</p>";
	long.sections.experience.items = Array.from({ length: 8 }, (_, index) => experience(index));
	long.sections.projects.items = Array.from({ length: 5 }, (_, index) => project(index));
	long.sections.education.items = medium.sections.education.items;
	long.sections.certifications.items = [
		{
			id: "certification-0",
			hidden: false,
			title: "Kiến trúc giải pháp",
			issuer: "Tổ chức đào tạo mẫu",
			date: "2025",
			website,
			description: "<p>Chứng chỉ dùng cho dữ liệu kiểm thử tổng hợp.</p>",
		},
	];

	const veryLong = structuredClone(long);
	veryLong.sections.experience.items = Array.from({ length: 14 }, (_, index) => experience(index));
	veryLong.sections.projects.items = Array.from({ length: 7 }, (_, index) => project(index));

	return { "short-vi": short, "medium-vi": medium, "long-vi": long, "very-long-vi": veryLong };
}
