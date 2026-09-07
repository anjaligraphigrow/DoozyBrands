import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { register } from "../api/auth";
import { getErrorMessage } from "../utils/errors";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim() || undefined,
        password,
      });

      setSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to create account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">OS</div>

        <h1>Create Account</h1>

        <p className="auth-subtitle">
          Register for access to DoozyBrands
        </p>

        {success ? (
          <div className="success-message">
            Account created successfully. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />

            <label>Phone Number (optional)</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Optional"
            />

            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
            <p className="field-hint">
              Must include an uppercase letter, a lowercase letter, and a
              number.
            </p>

            {error && <div className="error-message">{error}</div>}

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
