import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { USER_ROLES } from "../utils/roles";
import { saveSignupDraft } from "../utils/signupDraft";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada",
  "Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba",
  "Cyprus","Czech Republic","Denmark","Djibouti","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia",
  "Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Guatemala",
  "Guinea","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Mauritania","Mauritius","Mexico","Moldova","Monaco","Mongolia",
  "Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger",
  "Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea","Paraguay",
  "Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal",
  "Serbia","Sierra Leone","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","South Sudan","Spain",
  "Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo",
  "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay",
  "Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

export default function Signup() {
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const [role, setRole] = useState(USER_ROLES.VOLUNTEER);

  const [contactPref, setContactPref] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const [dialect, setDialect] = useState("");

  const [numOtherLangs, setNumOtherLangs] = useState("");
  const [numOtherLangsError, setNumOtherLangsError] = useState("");

  const [otherLangs, setOtherLangs] = useState("");
  const [comfortLang, setComfortLang] = useState("");
  const [comfortLangError, setComfortLangError] = useState("");

  const [originCountry, setOriginCountry] = useState("Pakistan");
  const [originCity, setOriginCity] = useState("");
  const [originCityError, setOriginCityError] = useState("");
  const [originLocality, setOriginLocality] = useState("");

  const [livedCountry, setLivedCountry] = useState("Pakistan");
  const [livedCity, setLivedCity] = useState("");
  const [livedCityError, setLivedCityError] = useState("");
  const [livedLocality, setLivedLocality] = useState("");
  const [placesLived, setPlacesLived] = useState([]);
  const [placesLivedError, setPlacesLivedError] = useState("");

  const { user } = useUser();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateUsername = (val) => /^[a-zA-Z0-9._-]{3,32}$/.test(val);
  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const validateMobile = (val) => /^03\d{2}-?\d{7}$/.test(val.replace(/\s/g, ""));
  const validateNumber = (val) => /^\d+$/.test(val);
  const validateCityName = (val) => /^[A-Za-z\s'.-]{2,}$/.test(val.trim());

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    if (value && !validateUsername(value)) {
      setUsernameError("3–32 characters, letters, numbers, dots, underscores, hyphens only");
    } else {
      setUsernameError("");
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

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError("");
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

  const handleOriginCityChange = (e) => {
    const value = e.target.value;
    setOriginCity(value);
    if (value && !validateCityName(value)) {
      setOriginCityError("Enter a valid city name");
    } else {
      setOriginCityError("");
    }
  };

  const handleLivedCityChange = (e) => {
    const value = e.target.value;
    setLivedCity(value);
    if (value && !validateCityName(value)) {
      setLivedCityError("Enter a valid city name");
    } else {
      setLivedCityError("");
    }
  };

  const addPlaceLived = () => {
    if (!livedCountry || !livedCity || !validateCityName(livedCity)) {
      setPlacesLivedError("Select a country and enter a valid city before adding");
      return;
    }
    setPlacesLived((prev) => [...prev, { country: livedCountry, city: livedCity.trim(), locality: livedLocality.trim() }]);
    setLivedCountry("Pakistan");
    setLivedCity("");
    setLivedLocality("");
    setPlacesLivedError("");
  };

  const removePlaceLived = (index) => {
    setPlacesLived((prev) => prev.filter((_, i) => i !== index));
  };


  const canSubmit =
    username &&
    validateUsername(username) &&
    role &&
    contactPref &&
    (contactPref !== "email" || (email && validateEmail(email))) &&
    (contactPref !== "mobile" || (mobile && validateMobile(mobile))) &&
    age &&
    gender &&
    dialect &&
    numOtherLangs !== "" &&
    validateNumber(numOtherLangs) &&
    !comfortLangError &&
    originCountry &&
    originCity &&
    validateCityName(originCity) &&
    placesLived.length > 0;

  const submit = () => {
    if (!canSubmit) return;

    const draft = {
      username,
      dialect,
      dialects: dialect ? [dialect] : [],
      gender,
      role,
      age,
      contactPref,
      email,
      mobile,
      numOtherLangs,
      otherLangs,
      comfortLang,
      placeOfOrigin: { country: originCountry, city: originCity.trim(), locality: originLocality.trim() },
      placesLived,
    };

    saveSignupDraft(draft);
    navigate("/consent");
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="w-full max-w-xl mx-auto space-y-3">

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

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400">I'm signing up as *</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  value: USER_ROLES.VOLUNTEER,
                  title: "Volunteer",
                  desc: "Record short Burushaski sentences for the project.",
                },
                {
                  value: USER_ROLES.CONTENT_CONTRIBUTOR,
                  title: "Content Contributor",
                  desc: "Upload or link Burushaski audio/video content.",
                },
                {
                  value: USER_ROLES.RESEARCHER,
                  title: "Researcher",
                  desc: "Upload interviews and longer-form recordings.",
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    role === opt.value
                      ? "border-yellow-400 bg-neutral-900"
                      : "border-neutral-700 bg-neutral-900/50 hover:bg-neutral-900"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="accent-yellow-400 mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{opt.title}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">

            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Username *</label>
              <input
                type="text"
                className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                  usernameError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                }`}
                placeholder="e.g. ali_hunza"
                value={username}
                onChange={handleUsernameChange}
                autoCapitalize="none"
                spellCheck={false}
              />
              {usernameError && <p className="text-xs text-red-400">{usernameError}</p>}
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
                  if (e.target.value !== "email") {
                    setEmail("");
                    setEmailError("");
                  }
                }}
              >
                <option value="">Select an option</option>
                <option value="email">Via Email</option>
                <option value="mobile">Via Mobile Number</option>
              </select>
            </div>

            {/* Email address */}
            {contactPref === "email" && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Email Address *</label>
                <input
                  type="email"
                  className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    emailError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                  }`}
                  placeholder="name@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {emailError && <p className="text-xs text-red-400">{emailError}</p>}
              </div>
            )}

            {/* Mobile number */}
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

            {/* Age */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">What is your age? *</label>
              <input
                type="number"
                min="1"
                max="120"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Enter your age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
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

            {/* Place of origin */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Place of origin *</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                >
                  <option value="">Country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    originCityError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                  }`}
                  placeholder="City"
                  value={originCity}
                  onChange={handleOriginCityChange}
                />
              </div>
              {originCityError && <p className="text-xs text-red-400">{originCityError}</p>}
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Locality / Colony / Mohallah (optional)"
                value={originLocality}
                onChange={(e) => setOriginLocality(e.target.value)}
              />
            </div>

            {/* Places lived */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Places lived *</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  value={livedCountry}
                  onChange={(e) => setLivedCountry(e.target.value)}
                >
                  <option value="">Country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  className={`w-full rounded-lg bg-neutral-900 border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    livedCityError ? "border-red-500 focus:ring-red-400" : "border-neutral-700 focus:ring-yellow-400"
                  }`}
                  placeholder="City"
                  value={livedCity}
                  onChange={handleLivedCityChange}
                />
              </div>
              {livedCityError && <p className="text-xs text-red-400">{livedCityError}</p>}
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Locality / Colony / Mohallah (optional)"
                value={livedLocality}
                onChange={(e) => setLivedLocality(e.target.value)}
              />

              <button
                type="button"
                onClick={addPlaceLived}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-700"
              >
                + Add place
              </button>

              {placesLivedError && <p className="text-xs text-red-400">{placesLivedError}</p>}

              {placesLived.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {placesLived.map((p, i) => (
                    <span
                      key={`${p.country}-${p.city}-${i}`}
                      className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-full px-3 py-1 text-xs text-white"
                    >
                      {p.locality ? `${p.locality}, ` : ""}{p.city}, {p.country}
                      <button
                        type="button"
                        onClick={() => removePlaceLived(i)}
                        className="text-gray-400 hover:text-red-400 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dialect */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Which Burushaski dialect do you primarily speak? *
              </label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={dialect}
                onChange={(e) => setDialect(e.target.value)}
              >
                <option value="">Select dialect</option>
                <option value="hunza">Hunza</option>
                <option value="nagar">Nagar</option>
                <option value="yasin">Yasin</option>
              </select>
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

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next: Review Consent Form
          </button>

          <p className="text-center text-xs text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-yellow-400 hover:text-yellow-300 underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
