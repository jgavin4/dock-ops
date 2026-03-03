import { SignUp } from "@clerk/nextjs";
import { ClerkAuthDebug } from "@/components/clerk-auth-debug";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <ClerkAuthDebug />
      {/* Placeholder for Clerk bot protection (Smart CAPTCHA); without it Clerk falls back to Invisible CAPTCHA which can 401 */}
      <div id="clerk-captcha" className="min-h-[60px] w-full max-w-[400px]" />
      <SignUp />
    </div>
  );
}
