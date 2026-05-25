import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useEffect, useState } from "react";

export default function Instructions() {
  const navigate = useNavigate();
  const { user, loading } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait until user context has finished loading
    if (loading) return;

    // No user at all → go to onboarding
    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    // User has already seen instructions → skip to dashboard
    const hasSeenInstructions = localStorage.getItem("hasSeenInstructions");
    if (hasSeenInstructions === "true") {
      navigate("/dashboard", { replace: true });
      return;
    }

    // All good — show the instructions
    setReady(true);
  }, [loading, user, navigate]);

  const handleStart = () => {
    localStorage.setItem("hasSeenInstructions", "true");
    navigate("/dashboard", { replace: true });
  };

  const handleSkip = () => {
    localStorage.setItem("hasSeenInstructions", "true");
    navigate("/dashboard", { replace: true });
  };

  // Show nothing while we're figuring out what to do
  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-yellow-400 text-sm underline transition-colors"
            >
              Skip Instructions →
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-yellow-400 mb-2">
              Recording Instructions
            </h1>
            <p className="text-gray-300">
              Please read carefully before you begin
            </p>
          </div>
        </div>

        {/* Instructions Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-6 mb-6">

          {/* Step 1 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
              Select a Section
            </h2>
            <p className="text-gray-700 pl-10">
              Each section contains multiple sentences to record. Choose a section from the dashboard to begin.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
              Read the Burushaski Text
            </h2>
            <p className="text-gray-700 pl-10">
              You will see an <span className="text-gray-500 italic">English sentence</span> and a <span className="font-bold">Burushaski transliteration</span> (in bold).
            </p>
            <div className="pl-10 bg-gray-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <p className="text-sm text-gray-500 italic mb-1">I like mangoes.</p>
              <p className="text-lg font-bold text-gray-900">Ja aam Akosh.</p>
            </div>
            <p className="text-gray-700 pl-10 font-semibold text-red-600">
              ⚠️ Read ONLY the Burushaski text (bold), NOT the English!
            </p>
          </div>



          {/* Step 3 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
              Record Your Voice
            </h2>
            <p className="text-gray-700 pl-10">
              Click the <span className="font-semibold">Record</span> button to start recording.
            </p>
            <div className="pl-10 flex items-center gap-4">
              <div className="bg-black text-white px-4 py-2 rounded font-medium text-sm">
                🎙️ Record
              </div>
              <span className="text-gray-500">← Click this to start</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
              Stop Recording
            </h2>
            <p className="text-gray-700 pl-10">
              When finished speaking, click the <span className="font-semibold">Stop</span> button.
            </p>
            <div className="pl-10 flex items-center gap-4">
              <div className="bg-red-600 text-white px-4 py-2 rounded font-medium text-sm">
                ⏹️ Stop
              </div>
              <span className="text-gray-500">← Click this when done</span>
            </div>
          </div>

          {/* Step 5 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">5</span>
              Playback & Review
            </h2>
            <p className="text-gray-700 pl-10">
              Listen to your recording. If not satisfied, click <span className="font-semibold">Re-record</span>.
            </p>
          </div>

          {/* Step 6 */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">6</span>
              Submit & Continue
            </h2>
            <p className="text-gray-700 pl-10">
              Click <span className="font-semibold">Submit</span> to mark the sentence complete and move forward.
            </p>
          </div>

        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-xl text-lg shadow-lg transition-colors"
        >
          Start Recording →
        </button>

      </div>
    </div>
  );
}
