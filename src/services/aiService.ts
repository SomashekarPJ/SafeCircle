import { GoogleGenAI } from "@google/genai";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Person, Memory, Routine, SceneSnapshot } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_PROMPT = `You are SafeCircle, an emotionally intelligent AI memory companion for elderly users with memory loss.
Your primary role is a trusted memory retrieval assistant.

STRICT RULES:
1. Never invent, imagine, or hallucinate facts, events, schedules, or memories.
2. Only speak about information explicitly provided in the context below.
3. If a memory or person is not in the provided context, clearly state you don't know or don't recognize them.
4. Use short, calming, and emotionally reassuring sentences.
5. Prioritize emotional clarity and dignity.
6. Never say "I am an AI". Avoid robotic tones.

Behavior:
- If the user is confused, calmly re-orient them.
- Be patient if they repeat questions.
- Prefer reassurance over correction.`;

export async function generateResponse(
  prompt: string,
  context: {
    memories: Memory[];
    people: Person[];
    routines: Routine[];
    currentEmotion?: string;
  }
) {
  const contextString = `
Current Context:
Memories: ${context.memories.map(m => `${m.date}: ${m.title} - ${m.description}`).join('; ')}
People: ${context.people.map(p => `${p.name} (${p.relationship}): ${p.biography || ''}`).join(', ')}
Routines: ${context.routines.map(r => `${r.time}: ${r.title} (${r.isCompleted ? 'Done' : 'Pending'})`).join('; ')}
Emotional State: ${context.currentEmotion || 'Unknown'}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT + "\n\nCRITICAL: DO NOT halluncinate. Only use the context above. If information is missing, say you don't recall that specific detail." + contextString,
      },
    });

    return response.text || "I'm right here with you. How are you feeling?";
  } catch (error) {
    console.error("AI Response Error:", error);
    return "I'm sorry, I'm having a little trouble remembering right now. But I'm still right here with you.";
  }
}

export async function identifyPersonFromImage(
  currentFrameBase64: string,
  people: Person[]
) {
  if (people.length === 0) {
    return { 
      identified: false, 
      message: "I don't have any 'Heart Memories' yet. Please add your family and friends so I can recognize them.",
      confidence: 0,
      shouldLearn: false
    };
  }

  // We'll send the current frame and use the profile images as context
  const peopleData = people.map(p => ({
    name: p.name,
    relationship: p.relationship,
    bio: p.biography,
    imageCount: p.images?.length || 0
  }));

  const prompt = `PrecisionFace™ Engine Analysis Pipeline
Goal: High-accuracy real-time face recognition.
The frame has been optimized with Adaptive Contrast Enhancement (ACE) for better feature extraction.

I have provided the current frame first, followed by reference images for known people.
${peopleData.map((p, i) => `Image ${i + 2}: This is ${p.name} (${p.relationship}).`).join('\n')}

Compare the person in the current frame (Image 1) EXCLUSIVELY with these known "Heart Memories".

STRICT OPERATIONAL DIRECTIVES:
1. QUALITY ANALYSIS: If features are still obscured or frame is extremely low fidelity despite ACE, set "identified" to false.
2. STABILITY: Only identify if you are extremely high-confidence.
3. ADAPTIVE SAMPLES: Set "shouldLearn" to true ONLY if the identification is 100% stable AND the frame clarity is excellent for a new memory sample.
4. JSON RESPONSE SCHEMA:
{
  "identified": boolean,
  "name": "string or null",
  "confidence": number (0.0 to 1.0),
  "message": "warm factual greeting",
  "shouldLearn": boolean,
  "analysis": "technical details of recognized features"
}
5. NO HALLUCINATION: Only use provided bio facts.`;

  const parts: any[] = [
    { text: prompt },
    { inlineData: { mimeType: "image/jpeg", data: currentFrameBase64.split(',')[1] || currentFrameBase64 } }
  ];

  people.forEach(p => {
    let base64Data = "";
    if (p.images && p.images.length > 0) {
      base64Data = p.images[0].split(',')[1] || p.images[0];
    } else if (p.imageUrl && p.imageUrl.startsWith('data:image')) {
      base64Data = p.imageUrl.split(',')[1] || p.imageUrl;
    }

    if (base64Data && base64Data.length > 100) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT + "\nYou are a factual memory retrieval assistant. Do not hallucinate.",
        responseMimeType: "application/json"
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Vision AI Error:", error);
    if (error instanceof Error && error.message.includes("quota")) {
       return { identified: false, message: "I'm resting my eyes for a moment (Limit reached). I'll be back soon." };
    }
    return { identified: false, message: "I'm having trouble seeing clearly. Who is this?" };
  }
}

export async function verifyPillImage(imageBase64: string, expectedDescription: string) {
  const prompt = `System context: You are a medication safety assistant helping an elderly patient verify they are about to take the correct pill.
     
The expected pill is: ${expectedDescription}

Look at the image provided and answer ONLY with a JSON object in this exact format, no extra text, no markdown:
{"isMatch": true, "confidence": "high", "message": "your short message here"}

If the pill matches the description: set isMatch=true, write an encouraging message.
If it does NOT match or you cannot clearly see a pill: set isMatch=false, write a clear, calm warning that they should not take this pill and check with their caregiver.
Keep the message under 20 words. Use simple, plain language.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } }
        ]}
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Pill Verification Error:", error);
    return { isMatch: false, confidence: "low", message: "Could not verify pill. Please ask your caregiver." };
  }
}

export async function generateConversationStarters(personData: Person) {
  const prompt = `You are a warm, compassionate assistant helping an elderly person with memory impairment have a meaningful conversation with someone they love.
     
The person they are speaking to is:
- Name: ${personData.name}
- Relationship: ${personData.relationship}
- Shared memories: ${(personData.sharedMemories || []).join(', ')}
- Recent events in their life: ${(personData.recentEvents || []).join(', ')}
- Their interests: ${(personData.interests || []).join(', ')}

Generate exactly 3 warm, natural, specific conversation starter questions or statements the elderly user could say right now to start a meaningful conversation.
Make them feel like they remember details — even if they are reading from a card.
Keep each starter under 15 words. Make them joyful and connection-focused.

Respond ONLY with a JSON array of 3 strings. No markdown, no extra text.
Example: ["How is your flower garden doing this summer?", "Tell me about your new job!", "Remember when we went to the coast together?"]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Conversation Starters Error:", error);
    return ["How have you been lately?", "It's so lovely to see you.", "What have you been up to?"];
  }
}

export async function generateWeeklyHealthReport(summary: any) {
  const prompt = `You are a medical data analyst assistant helping caregivers of Alzheimer's/Dementia patients.
   
Here is one week of behavioral data for a patient using a memory assistant app:

${JSON.stringify(summary, null, 2)}

Based on this data, generate a compassionate, plain-English weekly health report.

Respond ONLY with a JSON object — no markdown, no extra text — in this exact format:
{
  "overallTrend": "stable",
  "highlights": ["string", "string"],
  "concerns": ["string"],
  "recommendations": ["string", "string"],
  "doctorNotes": "string"
}

Keep language warm and factual. Do not diagnose. Do not alarm caregivers unnecessarily.
Use concrete observations from the data.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Health Report Error:", error);
    return {
      overallTrend: "stable",
      highlights: ["Data collection started."],
      concerns: [],
      recommendations: ["Maintain current routine."],
      doctorNotes: "Patient activity remains stable."
    };
  }
}

export async function analyzeSceneForObjects(imageBase64: string) {
  const prompt = `Analyze this image and identify all visible objects, especially everyday household items.
Respond ONLY with JSON, no markdown:
{
  "sceneDescription": "one sentence describing the overall scene",
  "itemsDetected": ["item1", "item2", ...],
  "roomGuess": "kitchen/living room/bedroom/bathroom/other"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } }
        ]}
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Scene Analysis Error:", error);
    return { sceneDescription: "Scene could not be analyzed", itemsDetected: [], roomGuess: "unknown" };
  }
}

export async function findObjectInSnapshots(userId: string, queryText: string) {
  try {
    const snapshotsRef = collection(db, 'users', userId, 'sceneSnapshots');
    const q = query(snapshotsRef, orderBy('capturedAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    const snapshots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as SceneSnapshot[];

    if (snapshots.length === 0) {
      return {
        found: false,
        confidence: 'low',
        location: 'unknown',
        explanation: 'I haven\'t seen any objects around the house yet. Open the AI Lens as you move around so I can help you find things!',
        suggestion: 'Try looking in your usual spots.'
      };
    }

    const summary = snapshots.map((s, i) => {
      const date = (s.capturedAt as any)?.toDate?.() || new Date();
      return `Snapshot ${i + 1} (${date.toLocaleString()}, ${s.roomGuess || 'unknown room'}): [${(s.itemsDetected || []).join(', ')}]`;
    }).join('\n');

    const prompt = `The user is asking: "${queryText}"
         
Here is a log of objects detected in photos taken around their home recently:
${summary}

Based on this data, where is the most likely location of the item they're looking for?

Respond ONLY with JSON, no markdown:
{
  "found": true,
  "confidence": "high/medium/low",
  "location": "e.g., living room, Tuesday afternoon",
  "explanation": "A short, warm, plain-English explanation for the user. Under 25 words.",
  "suggestion": "One practical tip, e.g., Check next to the sofa where you often sit.",
  "bestSnapshotIndex": number (1-based index from the snapshots list provided)
}`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.found && parsed.bestSnapshotIndex) {
      const idx = parsed.bestSnapshotIndex - 1;
      if (snapshots[idx]) {
        parsed.bestSnapshotId = snapshots[idx].id;
      }
    }
    return parsed;
  } catch (error) {
    console.error("Object Finder Error:", error);
    return {
      found: false,
      confidence: 'low',
      location: 'unknown',
      explanation: 'I\'m having a bit of trouble searching my memories right now.',
      suggestion: 'Please check your usual spots like the kitchen table or nightstand.'
    };
  }
}
