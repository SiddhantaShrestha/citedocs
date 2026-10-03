import { prisma } from "../lib/db";
import { ingestDocument } from "../lib/ingest";

const fillers: { title: string; visibility: "team" | "admins"; text: string }[] = [
  {
    title: "Austin office routine",
    visibility: "team",
    text: "The Austin studio opens the lobby at 8:15. Front desk coverage there is shared by two contractors, and visitors pick up a blue sticker rather than a printed card. Desks on the second floor are cleared of mugs every Wednesday evening. People who split time with Portland still follow the Austin calendar when they sit in that building. The supply closet code changes each quarter and is posted on the inside of the door. Questions about that site go to austin-office@northline.studio.",
  },
  {
    title: "Chicago kitchen notes",
    visibility: "team",
    text: "Chicago keeps a small pantry on the west wall. Milk is restocked on Tuesdays. Anyone using the last of the coffee starts a new pot and writes the time on the board. Dishes left in the sink after 6 pm are run through the washer by the night cleaner. This note does not cover the Portland kitchen. Labeling rules for that other site live in the employee handbook, not here.",
  },
  {
    title: "Denver visitor log",
    visibility: "team",
    text: "Denver asks hosts to add a guest in the desk book by the prior afternoon. The book is paper, stored under the counter, and kept for one year. A host who forgets can still walk the guest up after signing the after-hours sheet. Badges for that office are green. The sheet is not emailed to Portland reception.",
  },
  {
    title: "Remote week trial",
    visibility: "team",
    text: "A six-week trial in July lets product staff work away from every office on Wednesdays and Thursdays only. The trial does not change the Portland rule about the first day of the week. Managers record who joined in a sheet called July trial. People on the trial still join the 11:00 standup on camera.",
  },
  {
    title: "Sick day call tree",
    visibility: "team",
    text: "If you wake up ill, text your manager and also the #coverage channel. The call tree lists a backup for each pod. A single day does not need paperwork. This tree is about who covers your meetings, not about how many illness days you have. Balances live in the leave policy.",
  },
  {
    title: "Holiday shutdown 2027",
    visibility: "team",
    text: "The studio plans to close from 24 December 2027 through 1 January 2028. People who must ship a release that week book the exception with their director by 1 November 2027. The closure is the same for Austin, Chicago, Denver, and Portland. It does not add or remove anyone's yearly vacation balance.",
  },
  {
    title: "Travel booking desk",
    visibility: "team",
    text: "Flights are booked by the travel desk, not by the traveler, once the trip is longer than one night. The desk aims to answer in two working days. Preferred airlines are listed on the intranet page Travel. Train travel under four hours does not need the desk. This note does not set hotel price caps.",
  },
  {
    title: "Client lunch etiquette",
    visibility: "team",
    text: "When you eat with a customer, pick a place both of you can walk to. Split the conversation so the customer talks at least half the time. Do not order the most expensive dish on the menu as a habit. Pay with the company card and keep the paper slip in your wallet until the claim is filed. The dollar line that needs a finance note is written in the expense policy, not in this etiquette page.",
  },
  {
    title: "Contractor driving notes",
    visibility: "team",
    text: "Contractors who drive between Austin sites log miles in the contractor portal, not in Expensify. The portal rate is set in each statement of work and is often different from the employee rate. Commuting from a contractor's home to the first site is unpaid. Report odometer photos for any week over 100 miles.",
  },
  {
    title: "Austin overnight stays",
    visibility: "team",
    text: "Staff visiting Austin from another city should use the two preferred inns on South Congress. Ask the travel desk which one has a room. Breakfast is included at both. This page is only about which building to try. Nightly price caps for Portland and New York are in the expense policy.",
  },
  {
    title: "Laptop loan closet",
    visibility: "team",
    text: "A spare machine can be borrowed from the IT closet for up to five working days. Write your name on the clipboard and return the charger with the machine. Loan machines are wiped the day they come back. They are not a substitute for the computer issued when someone joins. Lost loan machines follow the same security mailbox as any other missing computer.",
  },
  {
    title: "Badge reprint rules",
    visibility: "team",
    text: "A faded badge is reprinted at the Portland desk on Thursdays. Bring the old card. Reprints are free the first time each year and then cost is charged to the team social budget. Denver reprints happen on Mondays at that site's own desk. Do not mail a badge between cities.",
  },
  {
    title: "Denver guest network",
    visibility: "team",
    text: "The Denver guest network name is Northline-Guest-DN. The password is written on a card at that reception and swapped every other Thursday. Do not photograph the card. Portland has its own rotation, described in the security policy, and the two passwords are never the same.",
  },
  {
    title: "First afternoon checklist",
    visibility: "team",
    text: "After lunch on day one, a new person sets up email, joins the all-hands calendar, and reads the code of conduct. The checklist is a paper card in the welcome folder. It does not name a lunch partner. Buddy assignments, when they exist, are in the onboarding guide.",
  },
  {
    title: "November health cover reminder",
    visibility: "team",
    text: "Open enrollment for the next plan year is the first two weeks of November. People who already joined mid-year still use that window to change a plan. The reminder email subject is Plan choices. The deadline for a brand new person in their first month is a different rule and lives in the onboarding guide.",
  },
  {
    title: "Buddy rotation board",
    visibility: "team",
    text: "Design hires are paired from a board in the studio Notion. The board rotates every quarter. Engineering pairings are not listed on that board. If you are in design and your name is missing, tell the design manager before Friday of week one. Lunch on the first day is encouraged but not scheduled by this board.",
  },
  {
    title: "Thirty and sixty day chats",
    visibility: "team",
    text: "Managers hold an informal chat around the one month mark and again around two months. The chat is not a performance score. Notes stay in the manager's private doc. The length of the trial period itself is stated in the employee handbook. This page only describes the two conversations.",
  },
  {
    title: "Pantry label poster",
    visibility: "team",
    text: "A poster by the Portland pantry asks people to date leftovers. The poster is a reminder, not the rule. Cleaning day and time for that fridge are written in the employee handbook. Chicago follows a different cleaning day, covered in the Chicago kitchen notes.",
  },
  {
    title: "Salary rumor note",
    visibility: "admins",
    text: "People sometimes guess each other's pay in private channels. Admins should stop that thread and point the person to their own letter. Do not confirm or deny a guess. Real ranges are in the compensation bands note and must not be pasted here. This rumor note only says how to shut the conversation down.",
  },
  {
    title: "Spot award chatter",
    visibility: "admins",
    text: "A spot award is a small thank-you, usually a gift card, decided by a director in the same week as the work. It is not the yearly engineering extra pay. Dates and the size of that yearly pot are in the bonus review. Do not mix the two when someone asks in an admin channel.",
  },
  {
    title: "Support roster draft",
    visibility: "admins",
    text: "A draft roster for customer help lists six names and a backup. It is a staffing wish list for next year, not a decision. The date when that group would change managers, if it changes at all, is in the restructuring plan. This draft must not be shown in a team meeting.",
  },
  {
    title: "Goodbye pay rumor",
    visibility: "admins",
    text: "If someone asks what a person receives when a job ends, say the package is individual and you cannot discuss it. Do not invent a number of weeks. The figure for the two roles in the current plan is written only in the restructuring plan. This rumor page exists so admins give the same refusal.",
  },
  {
    title: "Offer letter checklist",
    visibility: "admins",
    text: "Before a letter goes out, confirm the title, the city, the start date, and that people operations has read it. The letter states one person's number, not a band. Bands and the point where a package needs a vice president are in the compensation bands note. Do not attach that note to the letter.",
  },
  {
    title: "Spend chatter",
    visibility: "admins",
    text: "Admins sometimes approve a tool purchase in chat and forget the paper trail. Anything a manager could have approved alone should still be in Expensify. Anything larger waits for the people named in the compensation bands note. This chatter page does not repeat those dollar lines.",
  },
];

async function main() {
  const team = await prisma.team.findFirst({ where: { name: "Demo" } });
  if (!team) throw new Error('Demo team not found. Run "npm run db:seed" first.');

  for (const filler of fillers) {
    const existing = await prisma.document.findFirst({
      where: { teamId: team.id, title: filler.title },
    });
    if (existing && existing.text === filler.text && existing.visibility === filler.visibility) {
      console.log(`skip ${filler.title}`);
      continue;
    }
    const saved = existing
      ? await prisma.document.update({
          where: { id: existing.id },
          data: { text: filler.text, visibility: filler.visibility },
        })
      : await prisma.document.create({
          data: {
            teamId: team.id,
            title: filler.title,
            visibility: filler.visibility,
            text: filler.text,
          },
        });
    const chunks = await ingestDocument(saved.id);
    console.log(`${existing ? "replace" : "create"} ${filler.title} (${chunks})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
