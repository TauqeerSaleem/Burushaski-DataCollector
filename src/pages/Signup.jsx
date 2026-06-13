import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthCard from "../Components/AuthCard";
import {
  loadSignupDraft,
  saveSignupDraft,
  validateUsername,
} from "../utils/signupDraft";
import { useUser } from "../context/UserContext";

const DIALECTS = [
  { value: "hunza", label: "Hunza" },
  { value: "nagar", label: "Nagar" },
  { value: "yasin", label: "Yasin" },
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function readDraftField(field) {
  return loadSignupDraft()?.[field] || "";
}

export default function Signup() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [name, setName] = useState(() => readDraftField("name"));
  const [username, setUsername] = useState(() => readDraftField("username"));
  const [age, setAge] = useState(() => readDraftField("age"));
  const [gender, setGender] = useState(() => readDraftField("gender"));
  const [dialect, setDialect] = useState(() => readDraftField("dialect"));
  const [otherLanguages, setOtherLanguages] = useState(() =>
    readDraftField("otherLanguages")
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(() =>
    readDraftField("placeOfBirth")
  );
  const [placesLived, setPlacesLived] = useState(() =>
    readDraftField("placesLived")
  );
  const [usernameError, setUsernameError] = useState("");

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleUsernameChange = (event) => {
    const value = event.target.value;
    setUsername(value);

    if (value && !validateUsername(value)) {
      setUsernameError(
        "Use 3–32 characters: letters, numbers, dots, underscores, or hyphens."
      );
    } else {
      setUsernameError("");
    }
  };

  const isFormValid =
    name.trim() &&
    validateUsername(username) &&
    age.trim() &&
    gender &&
    dialect &&
    otherLanguages.trim() &&
    placeOfBirth.trim() &&
    placesLived.trim();

  const submit = (event) => {
    event.preventDefault();
    if (!isFormValid) return;

    saveSignupDraft({
      name: name.trim(),
      username: username.trim(),
      age: age.trim(),
      gender,
      dialect,
      otherLanguages: otherLanguages.trim(),
      placeOfBirth: placeOfBirth.trim(),
      placesLived: placesLived.trim(),
    });

    navigate("/consent");
  };

  return (
    <AuthCard
      title="Sign Up"
      subtitle="Tell us about yourself before you start recording"
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="name" className="text-xs text-gray-400">
              Full Name
            </label>
            <input
              id="name"
              className="input-field"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="username" className="text-xs text-gray-400">
              Username
            </label>
            <input
              id="username"
              className={`input-field ${usernameError ? "border-red-500 focus:ring-red-400" : ""}`}
              placeholder="Choose a username for login"
              value={username}
              onChange={handleUsernameChange}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            {usernameError && (
              <p className="text-xs text-red-400">{usernameError}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="age" className="text-xs text-gray-400">
              Age
            </label>
            <input
              id="age"
              type="number"
              min="1"
              max="120"
              className="input-field"
              placeholder="e.g. 25"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="gender" className="text-xs text-gray-400">
              Gender
            </label>
            <select
              id="gender"
              className="select-field"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select gender</option>
              {GENDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="dialect" className="text-xs text-gray-400">
              Burushaski Dialect
            </label>
            <select
              id="dialect"
              className="select-field"
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
            >
              <option value="">Select dialect</option>
              {DIALECTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="otherLanguages" className="text-xs text-gray-400">
              Other Languages Spoken
            </label>
            <input
              id="otherLanguages"
              className="input-field"
              placeholder="e.g. Urdu, English, Shina"
              value={otherLanguages}
              onChange={(e) => setOtherLanguages(e.target.value)}
            />
            <p className="text-xs text-gray-500">Separate multiple languages with commas</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="placeOfBirth" className="text-xs text-gray-400">
              Place of Birth
            </label>
            <input
              id="placeOfBirth"
              className="input-field"
              placeholder="e.g. Hunza"
              value={placeOfBirth}
              onChange={(e) => setPlaceOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="placesLived" className="text-xs text-gray-400">
              Places Lived
            </label>
            <input
              id="placesLived"
              className="input-field"
              placeholder="e.g. Hunza, Karachi"
              value={placesLived}
              onChange={(e) => setPlacesLived(e.target.value)}
            />
            <p className="text-xs text-gray-500">Separate multiple places with commas</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isFormValid}
          className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Consent
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link to="/login" className="text-yellow-400 hover:text-yellow-300 underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
