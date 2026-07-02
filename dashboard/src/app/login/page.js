'use client';

import LoginForm from '@/components/auth/LoginForm';
import { AuthProvider } from '@/lib/auth-context';

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
