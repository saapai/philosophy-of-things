import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://ygcorlazwxovaqoiktgd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnY29ybGF6d3hvdmFxb2lrdGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzE2OTIsImV4cCI6MjA4ODA0NzY5Mn0.aIx1HEHq6eMLDjMJpK-GVEI40oQ6I0ZwiUXmTGSHplc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Export for use in other scripts
window.supabase = supabase;

// DOM Elements
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const googleBtn = document.getElementById('googleBtn');
const switchText = document.getElementById('switchText');
const switchLink = document.getElementById('switchLink');
const authError = document.getElementById('authError');

let isSignUp = false;

// Check if already logged in
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Already logged in, redirect to draft
    window.location.href = '/draft';
  }
}

// Show error message
function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

// Hide error message
function hideError() {
  authError.style.display = 'none';
}

// Toggle between sign in and sign up
function toggleMode() {
  isSignUp = !isSignUp;
  hideError();

  if (isSignUp) {
    authTitle.textContent = 'Sign Up';
    authSubtitle.textContent = 'Create an account to start writing';
    submitBtn.textContent = 'Sign up';
    switchText.textContent = 'Already have an account?';
    switchLink.textContent = 'Sign in';
  } else {
    authTitle.textContent = 'Sign In';
    authSubtitle.textContent = 'Sign in to access your dashboard';
    submitBtn.textContent = 'Sign in';
    switchText.textContent = "Don't have an account?";
    switchLink.textContent = 'Sign up';
  }
}

// Google sign in
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/draft'
    }
  });

  if (error) {
    showError(error.message);
  }
}

// Email/password sign in or sign up
async function handleSubmit(e) {
  e.preventDefault();
  hideError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';

  try {
    let result;

    if (isSignUp) {
      result = await supabase.auth.signUp({
        email,
        password
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      showError(result.error.message);
      return;
    }

    if (isSignUp && result.data.user && !result.data.session) {
      // Email confirmation required
      showError('Check your email to confirm your account');
      return;
    }

    // Success - redirect to draft
    window.location.href = '/draft';
  } catch (err) {
    showError('An error occurred. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isSignUp ? 'Sign up' : 'Sign in';
  }
}

// Event listeners
googleBtn.addEventListener('click', signInWithGoogle);
authForm.addEventListener('submit', handleSubmit);
switchLink.addEventListener('click', (e) => {
  e.preventDefault();
  toggleMode();
});

// Check auth on load
checkAuth();
