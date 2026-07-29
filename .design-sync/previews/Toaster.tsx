import { Toaster } from "@tnm-hr-platform/ui/components/sonner";
import { useEffect } from "react";
import { toast } from "sonner";

// Toaster is the toast host. Fire a persistent toast on mount so the card
// shows a real notification instead of an empty portal.
export const Notification = () => {
	useEffect(() => {
		toast.success("Resume published", {
			description: "“Software Engineer” is now live at localhost:3000/jane-doe.",
			duration: Number.POSITIVE_INFINITY,
		});
	}, []);
	return (
		<div style={{ minHeight: 140 }}>
			<Toaster position="top-center" />
		</div>
	);
};
