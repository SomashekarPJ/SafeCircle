import { memoryService } from './memoryService';
import { Person, Memory, Routine } from '../types';

export async function seedInitialData() {
  const people = await memoryService.getPeople();
  if (people.length > 0) return;

  console.log("Seeding sample data for demo...");

  const samplePeople: Person[] = [
    {
      name: "Ananya",
      relationship: "Daughter",
      biography: "Your youngest daughter who loves to garden. She visits every Sunday with fresh flowers. She often wears a blue scarf that you gave her.",
      lastVisit: new Date().toISOString(),
      imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    },
    {
      name: "Rohan",
      relationship: "Son",
      biography: "Your son who lives in Chennai. He calls you every Saturday morning to talk about cricket. He has a very loud, happy laugh just like your father had.",
      imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
    }
  ];

  const sampleMemories: Memory[] = [
    {
      title: "Rohan's Graduation",
      description: "We all went to Bangalore for Rohan's graduation ceremony. It was a very proud day for the whole family.",
      date: "2023-06-15T10:00:00Z",
      isEmotional: true
    },
    {
      title: "Family Trip to Mysore",
      description: "You and the kids visited the Mysore Palace. You enjoyed the evening lights and the horse carriage ride.",
      date: "2022-12-20T14:00:00Z",
    }
  ];

  const sampleRoutines: Routine[] = [
    {
      title: "Morning Medicine",
      time: "09:00 AM",
      type: "medication",
      isCompleted: false,
      notes: "Blue pill after breakfast"
    },
    {
      title: "Afternoon Walk",
      time: "04:30 PM",
      type: "exercise",
      isCompleted: false
    },
    {
      title: "Check-in with Ananya",
      time: "07:00 PM",
      type: "appointment",
      isCompleted: false
    }
  ];

  for (const p of samplePeople) await memoryService.addPerson(p);
  for (const m of sampleMemories) await memoryService.addMemory(m);
  for (const r of sampleRoutines) await memoryService.addRoutine(r);
  
  // Seed default settings to prevent crashes on first use
  await memoryService.updateUserSettings({
    homeAddress: "Cubbon Park, Bengaluru, Karnataka",
    homeLatLng: { lat: 12.9778, lng: 77.5947 },
    hydrationEnabled: true,
    hydrationIntervalMinutes: 60,
    safeZoneRadiusMeters: 500,
    caregiverPin: "1234"
  });
  
  console.log("Seeding complete.");
}
