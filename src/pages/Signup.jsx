import { useState, useRef } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { USER_ROLES } from "../utils/roles";
import { signupUser, checkUsernameAvailable } from "../utils/userApi";
import { clearSignupDraft, draftToSignupPayload, saveSignupDraft } from "../utils/signupDraft";

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
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const usernameCheckTimer = useRef(null);

  const [role, setRole] = useState(USER_ROLES.VOLUNTEER);

  const [contactPref, setContactPref] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [occupation, setOccupation] = useState("");

  const [dialect, setDialect] = useState("");

  const [otherLangs, setOtherLangs] = useState([]);
  const [otherLangsOther, setOtherLangsOther] = useState("");
  const [comfortLang, setComfortLang] = useState("");

  const [originCountry, setOriginCountry] = useState("Pakistan");
  const [originCity, setOriginCity] = useState("");
  const [originCityError, setOriginCityError] = useState("");
  const [originLocality, setOriginLocality] = useState("");

  const [livedCountry, setLivedCountry] = useState("Pakistan");
  const [livedCity, setLivedCity] = useState("");
  const [livedCityError, setLivedCityError] = useState("");
  const [livedLocality, setLivedLocality] = useState("");
  const [livedTimeLived, setLivedTimeLived] = useState("");
  const [placesLived, setPlacesLived] = useState([]);
  const [placesLivedError, setPlacesLivedError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const { user, setUser } = useUser();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const isResearcher = role === USER_ROLES.RESEARCHER;

  const validateUsername = (val) => /^[a-zA-Z0-9._-]{3,32}$/.test(val);
  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const validateMobile = (val) => /^03\d{2}-?\d{7}$/.test(val.replace(/\s/g, ""));
  const validateCityName = (val) => /^[A-Za-z\s'.-]{2,}$/.test(val.trim());

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    setUsernameAvailable(null);
    setUsernameChecking(false);
    clearTimeout(usernameCheckTimer.current);

    if (value && !validateUsername(value)) {
      setUsernameError("3–32 characters, letters, numbers, dots, underscores, hyphens only");
      return;
    }
    setUsernameError("");

    if (value && validateUsername(value)) {
      setUsernameChecking(true);
      usernameCheckTimer.current = setTimeout(async () => {
        try {
          const available = await checkUsernameAvailable(value);
          setUsernameAvailable(available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setUsernameChecking(false);
        }
      }, 500);
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

  const toggleOtherLang = (lang) => {
    setOtherLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
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

  const handleCityBlur = () => {
    if (livedCountry && livedCity && validateCityName(livedCity)) {
      const isDuplicate = placesLived.some(
        (p) => p.city.toLowerCase() === livedCity.trim().toLowerCase() && p.country === livedCountry
      );
      if (!isDuplicate) {
        setPlacesLived((prev) => [...prev, {
          country: livedCountry,
          city: livedCity.trim(),
          locality: "",
          timeLived: "",
        }]);
      }
    }
  };

  const updateLastPlace = (locality, timeLived) => {
    setPlacesLived((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (
        last.city.toLowerCase() === livedCity.trim().toLowerCase() &&
        last.country === livedCountry
      ) {
        updated[updated.length - 1] = {
          ...last,
          locality: locality.trim(),
          timeLived: timeLived.trim(),
        };
      }
      return updated;
    });
  };

  const commitCurrentPlace = () => {
    if (!livedCountry || !livedCity || !validateCityName(livedCity)) return;
    const isDuplicate = placesLived.some(
      (p) => p.city.toLowerCase() === livedCity.trim().toLowerCase() && p.country === livedCountry
    );
    if (!isDuplicate) {
      setPlacesLived((prev) => [...prev, {
        country: livedCountry,
        city: livedCity.trim(),
        locality: livedLocality.trim(),
        timeLived: livedTimeLived.trim(),
      }]);
    }
    setLivedCountry("Pakistan");
    setLivedCity("");
    setLivedLocality("");
    setLivedTimeLived("");
    setPlacesLivedError("");
    setLivedCityError("");
  };

  const removePlaceLived = (index) => {
    setPlacesLived((prev) => prev.filter((_, i) => i !== index));
  };

  const hasBasicInfo =
    (!isResearcher || name.trim()) &&
    username &&
    validateUsername(username) &&
    role &&
    contactPref &&
    (contactPref !== "email" || (email && validateEmail(email))) &&
    (contactPref !== "mobile" || (mobile && validateMobile(mobile)));

  const hasCrowdsourcedInfo = dialect;

  const canSubmit = hasBasicInfo && (isResearcher || hasCrowdsourcedInfo) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;

    const draft = {
      name: name.trim(),
      username,
      dialect,
      dialects: dialect ? [dialect] : [],
      gender,
      role,
      age,
      contactPref,
      email,
      mobile,
      otherLangs,
      otherLangsOther,
      comfortLang,
      educationLevel,
      occupation,
      placeOfOrigin: { country: originCountry, city: originCity.trim(), locality: originLocality.trim() },
      placesLived,
    };

    if (isResearcher) {
      setSubmitError("");
      setSubmitting(true);

      try {
        const researcher = await signupUser({
          ...draftToSignupPayload(draft),
          consentAccepted: false,
        });
        clearSignupDraft();
        setUser(researcher);

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          await subscribeToPush(researcher);
        }

        navigate("/dashboard", { replace: true });
      } catch (err) {
        setSubmitError(err.message || "Unable to complete signup.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    saveSignupDraft(draft);
    navigate("/consent");
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="w-full max-w-xl mx-auto space-y-3">
        <div className="rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-2xl border border-neutral-800 space-y-6">

          {step === 1 ? (
            <>
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
                  Sign Up
                </h1>
                <p className="text-sm text-gray-400">
                  Help us record Burushaski sentences
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {isResearcher
                    ? "Create your researcher access profile for the project dashboard."
                    : "We are collecting short audio recordings of Burushaski speech along with basic demographic information for academic research."}
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
                      desc: "Only select this if you have been explicitly assigned this role by the project admin.",
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
                  {!usernameError && usernameChecking && <p className="text-xs text-gray-500">Checking availability...</p>}
                  {!usernameError && !usernameChecking && usernameAvailable === true && <p className="text-xs text-green-400">✓ Username is available</p>}
                  {!usernameError && !usernameChecking && usernameAvailable === false && <p className="text-xs text-red-400">✗ Username is already taken</p>}
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
                      if (e.target.value !== "mobile") { setMobile(""); setMobileError(""); }
                      if (e.target.value !== "email") { setEmail(""); setEmailError(""); }
                    }}
                  >
                    <option value="">Select an option</option>
                    <option value="email">Via Email</option>
                    <option value="mobile">Via Mobile Number</option>
                  </select>
                </div>

                {/* Email */}
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

                {/* Mobile */}
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

                {/* Dialect */}
                {!isResearcher && (
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
                )}

                {/* Name — researcher only */}
                {isResearcher && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400">Name *</label>
                    <input
                      type="text"
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}
              </div>

              {submitError && <p className="text-xs text-red-400">{submitError}</p>}

              <button
                onClick={isResearcher ? submit : () => setStep(2)}
                disabled={!canSubmit || submitting}
                className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating account..." : isResearcher ? "Create Account" : "Next"}
              </button>

              <p className="text-center text-xs text-gray-500">
                Already have an account?{" "}
                <Link to="/login" className="text-yellow-400 hover:text-yellow-300 underline">
                  Log in
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
                  Optional Information
                </h1>
                <p className="text-sm text-gray-400">
                  Help us build better Burushaski research
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The details below will help us produce more accurate translation models and support future Burushaski language research. We'd really appreciate you filling them in — but you can also skip straight to the consent form.
                </p>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Name
                    <span className="block mt-0.5 font-normal text-gray-500">In case we need to reach out to you directly</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {/* Age */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Age
                    <span className="block mt-0.5 font-normal text-gray-500">To understand whether Burushaski language use varies across age groups</span>
                  </label>
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
                  <label className="text-xs text-gray-400">
                    Gender
                    <span className="block mt-0.5 font-normal text-gray-500">To study whether gender plays a role in Burushaski speech patterns</span>
                  </label>
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

                {/* Education level */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Highest level of education
                    <span className="block mt-0.5 font-normal text-gray-500">To explore whether education level influences how Burushaski is used</span>
                  </label>
                  <select
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                  >
                    <option value="">Select education level</option>
                    <option value="no_formal_schooling">No formal schooling</option>
                    <option value="primary">Primary (up to grade 5)</option>
                    <option value="middle">Middle (up to grade 8)</option>
                    <option value="matric">Matric (up to grade 10 / O level)</option>
                    <option value="secondary">Secondary (up to grade 12 / A level)</option>
                    <option value="undergrad">Undergrad</option>
                    <option value="tertiary">Tertiary</option>
                  </select>
                </div>

                {/* Occupation */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Occupation
                    <span className="block mt-0.5 font-normal text-gray-500">To examine whether a speaker's occupation is linked to language use</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="e.g. Teacher, Farmer, Student"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                  />
                </div>

                {/* Place of origin */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Place of origin
                    <span className="block mt-0.5 font-normal text-gray-500">To understand how cultural, ancestral, or historical roots shape the way Burushaski is spoken</span>
                  </label>
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
                  <label className="text-xs text-gray-400">
                    Places lived
                    <span className="block mt-0.5 font-normal text-gray-500">To study how living in different regions affects Burushaski speech patterns</span>
                  </label>
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
                      onBlur={handleCityBlur}
                    />
                  </div>
                  {livedCityError && <p className="text-xs text-red-400">{livedCityError}</p>}
                  <input
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Locality / Colony / Mohallah (optional)"
                    value={livedLocality}
                    onChange={(e) => {
                      setLivedLocality(e.target.value);
                      updateLastPlace(e.target.value, livedTimeLived);
                    }}
                  />
                  <input
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Time lived here (optional, e.g. 2 years)"
                    value={livedTimeLived}
                    onChange={(e) => {
                      setLivedTimeLived(e.target.value);
                      updateLastPlace(livedLocality, e.target.value);
                    }}
                  />

                  {placesLivedError && <p className="text-xs text-red-400">{placesLivedError}</p>}

                  {placesLived.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {placesLived.map((p, i) => (
                        <span
                          key={`${p.country}-${p.city}-${i}`}
                          className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-full px-3 py-1 text-xs text-white"
                        >
                          {p.locality ? `${p.locality}, ` : ""}{p.city}, {p.country}{p.timeLived ? ` (${p.timeLived})` : ""}
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

                  <button
                    type="button"
                    onClick={commitCurrentPlace}
                    className="w-full rounded-lg bg-neutral-800 border border-neutral-700 py-1.5 text-sm text-white hover:bg-neutral-700"
                  >
                    + Add another place
                  </button>
                </div>

                {/* Which other languages */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Which other languages do you speak?
                    <span className="block mt-0.5 font-normal text-gray-500">To understand how multilingualism influences Burushaski use</span>
                  </label>
                  <div className="flex flex-col gap-1 pt-1">
                    {["Shina", "Wakhi", "Khowar", "Urdu", "English", "Punjabi", "Pashto"].map((lang) => (
                      <label key={lang} className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={otherLangs.includes(lang)}
                          onChange={() => toggleOtherLang(lang)}
                          className="accent-yellow-400"
                        />
                        {lang}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={otherLangs.includes("other")}
                        onChange={() => toggleOtherLang("other")}
                        className="accent-yellow-400"
                      />
                      Others
                    </label>
                    {otherLangs.includes("other") && (
                      <input
                        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="eg Mandarin, Spanish, Turkish"
                        value={otherLangsOther}
                        onChange={(e) => setOtherLangsOther(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Most comfortable language */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">
                    Which language are you most comfortable speaking?
                    <span className="block mt-0.5 font-normal text-gray-500">To identify the language you use most naturally in everyday life</span>
                  </label>
                  <input
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="e.g. Burushaski"
                    value={comfortLang}
                    onChange={(e) => setComfortLang(e.target.value)}
                  />
                </div>
              </div>

              {submitError && <p className="text-xs text-red-400">{submitError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Review Consent Form
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}