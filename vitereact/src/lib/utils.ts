import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Date utility functions
export function formatDateForInput(date: Date | string): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '';
	return d.toISOString().split('T')[0];
}

export function isValidDateString(dateString: string): boolean {
	if (!dateString) return true; // Allow empty dates
	// Check if it matches YYYY-MM-DD format
	if (!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
	const date = new Date(dateString + 'T00:00:00.000Z'); // Use UTC to avoid timezone issues
	return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString;
}

export function formatDateForDisplay(dateString: string): string {
	if (!dateString || !isValidDateString(dateString)) return '';
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

export function getTodayDateString(): string {
	return new Date().toISOString().split('T')[0];
}

export function getMaxBookingDate(): string {
	// Allow bookings up to 1 year from now
	const maxDate = new Date();
	maxDate.setFullYear(maxDate.getFullYear() + 1);
	return maxDate.toISOString().split('T')[0];
}
