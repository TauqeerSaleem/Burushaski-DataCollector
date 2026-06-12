//SIGNUP.JSX
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { DEFAULT_USER_ROLE } from "../utils/roles";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [consent, setConsent] = useState("");

  const [contactPref, setContactPref] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");

  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");

  const [dialects, setDialects] = useState([]);
  const [otherDialect, setOtherDialect] = useState("");

  const [numOtherLangs, setNumOtherLangs] = useState("");
  const [numOtherLangsError, setNumOtherLangsError] = useState("");

  const [otherLangs, setOtherLangs] = useState("");
  const [comfortLang, setComfortLang] = useState("");
  const [comfortLangError, setComfortLangError] = useState("");

  const { setUser } = useUser();
  const navigate = useNavigate();

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validateMobile = (val) => /^03\d{2}-?\d{7}$/.test(val.replace(/\s/g, ""));
  const validateNumber = (val) => /^\d+$/.test(val);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleMobileChange = (e) => {
    const value = e.target.value;
    setMobile(value);
    if (value && !validateMobile(value)) {
      setMobileError("Enter a valid mobile number (e.g. 03XX-XXXXXXX)");
    } else {
      setMobileError("");
    }
  };

  const handleNumOtherLangsChange = (e) => {
    const value = e.target.value;
    setNumOtherLangs(value);
    if (value && !validateNumber(value)) {
      setNumOtherLangsError("Must be a number");
    } else {
      setNumOtherLangsError("");
    }
  };

  const handleComfortLangChange = (e) => {
    const value = e.target.value;
    setComfortLang(value);
    if (value && otherLangs && !otherLangs.toLowerCase().includes(value.toLowerCase())) {
      setComfortLangError("Should be one of the languages you listed above");
    } else {
      setComfortLangError("");
    }
  };

  const toggleDialect = (value) => {
    setDialects((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value]
    );
  };

  const primaryDialect = () => {
    if (dialects.includes("hunza")) return "hunza";
    if (dialects.includes("yasin")) return "yasin";
    return dialects[0] || "";
  };

  const canSubmit =
    email &&
    validateEmail(email) &&
    consent === "yes" &&
    contactPref &&
    (contactPref !== "mobile" || (mobile && validateMobile(mobile))) &&
    ageGroup &&
    gender &&
    dialects.length > 0 &&
    numOtherLangs !== "" &&
    validateNumber(numOtherLangs) &&
    !comfortLangError;

  const submit = async () => {
    if (!canSubmit) return;

    const userData = {
      email,
      username: email,
      dialect: primaryDialect(),
      gender,
      role: DEFAULT_USER_ROLE,
      ageGroup,
      contactPref,
      mobile,
      dialects,
      otherDialect,
      numOtherLangs,
      otherLangs,
      comfortLang,
    };

    if (Notification.permission === "granted") {
      await subscribeToPush(userData);
    }

    setUser(userData);
    navigate("/instructions", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-3">

        <button
          onClick={() => navigate("/")}
          className="text-sm text-gray-400 hover:text-yellow-400"
        >
          ← Back to Login
        </button>

        <div className="rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-2xl border border-neutral-800 space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
              Sign Up
            </h1>
            <p className="text-sm text-gray-400">
              Help us record Burushaski sentences
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              We are collecting short audio recordings of Burushaski speech
              along with basic demographic information for academic research.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Email *</label>
              <input
                type="email"
                className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  emailError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                }`}
                placeholder="you@example.com"
                value={email}
                onChange={handleEmailChange}
              />
              {emailError && <p className="text-xs text-red-400">{emailError}</p>}
            </div>

            {/* Consent */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Do you consent to providing demographic information for research purposes? *
              </label>
              <div className="flex gap-4 pt-1">
                {["yes", "no"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="radio"
                      name="consent"
                      value={opt}
                      checked={consent === opt}
                      onChange={(e) => setConsent(e.target.value)}
                      className="accent-yellow-400"
                    />
                    {opt === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
              {consent === "no" && (
                <p className="text-xs text-red-400">Consent is required to sign up</p>
              )}
            </div>

            {/* Contact preference */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                How would you prefer to be contacted? *
              </label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={contactPref}
                onChange={(e) => {
                  setContactPref(e.target.value);
                  if (e.target.value !== "mobile") {
                    setMobile("");
                    setMobileError("");
                  }
                }}
              >
                <option value="">Select an option</option>
                <option value="email">Via Email</option>
                <option value="mobile">Via Mobile Number</option>
              </select>
            </div>

            {/* Mobile number (only if mobile preferred) */}
            {contactPref === "mobile" && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Mobile Number *</label>
                <input
                  className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    mobileError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                  }`}
                  placeholder="03XX-XXXXXXX"
                  value={mobile}
                  onChange={handleMobileChange}
                />
                {mobileError && <p className="text-xs text-red-400">{mobileError}</p>}
              </div>
            )}

            {/* Age group */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">What is your age group? *</label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
              >
                <option value="">Select age group</option>
                <option value="under18">Under 18</option>
                <option value="18-25">18 - 25</option>
                <option value="26-35">26 - 35</option>
                <option value="35-45">35 - 45</option>
                <option value="46-60">46 - 60</option>
                <option value="60+">60+</option>
              </select>
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">What is your gender? *</label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            {/* Dialect (multi-select) */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Which Burushaski dialect do you primarily speak? *
              </label>
              <div className="flex flex-col gap-1 pt-1">
                {[
                  { value: "hunza", label: "Hunza" },
                  { value: "nagar", label: "Nagar" },
                  { value: "yasin", label: "Yasin" },
                  { value: "mixed", label: "Mixed" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={dialects.includes(opt.value)}
                      onChange={() => toggleDialect(opt.value)}
                      className="accent-yellow-400"
                    />
                    {opt.label}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={dialects.includes("other")}
                    onChange={() => toggleDialect("other")}
                    className="accent-yellow-400"
                  />
                  Other:
                </label>
                {dialects.includes("other") && (
                  <input
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Please specify"
                    value={otherDialect}
                    onChange={(e) => setOtherDialect(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Number of other languages */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                How many other languages do you speak besides Burushaski? *
              </label>
              <input
                className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  numOtherLangsError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                }`}
                placeholder="e.g. 2"
                value={numOtherLangs}
                onChange={handleNumOtherLangsChange}
              />
              {numOtherLangsError && <p className="text-xs text-red-400">{numOtherLangsError}</p>}
            </div>

            {/* Which other languages */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Which other languages do you speak? (optional)
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. Urdu, English"
                value={otherLangs}
                onChange={(e) => setOtherLangs(e.target.value)}
              />
            </div>

            {/* Most comfortable language */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Which language are you most comfortable speaking? (optional)
              </label>
              <input
                className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  comfortLangError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                }`}
                placeholder="e.g. Burushaski"
                value={comfortLang}
                onChange={handleComfortLangChange}
              />
              {comfortLangError && <p className="text-xs text-red-400">{comfortLangError}</p>}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sign Up
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500">
            Your data is anonymous and used only for research.
          </p>
        </div>
      </div>
    </div>
  );
}