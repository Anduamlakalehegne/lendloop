"use client";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from "convex/react";
import { SignInButton, UserButton, Show } from "@clerk/nextjs";
import {
  ArrowUpRight,
  ArrowRight,
  Leaf,
  Wrench,
  Sprout,
  ChefHat,
  Tent,
  Package,
  ShieldCheck,
  HeartHandshake,
  Search,
  Plus,
  Check,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { configured, hasClerk } from "@/components/providers";
import { CategoryIcon } from "@/components/tool-icon";
import { Dashboard } from "@/components/dashboard";
import { categories } from "@/lib/rules";
const samples = [
  { name: "Cordless drill", category: "Power tools" },
  { name: "Garden hand tools", category: "Garden" },
  { name: "Pasta maker", category: "Kitchen" },
  { name: "Weekend camping tent", category: "Camping" },
  { name: "Orbital sander", category: "Power tools" },
  { name: "Pressure washer", category: "Garden" },
];
function SignIn({
  children,
  className = "button primary",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return hasClerk ? (
    <SignInButton mode="modal">
      <button className={className}>{children}</button>
    </SignInButton>
  ) : (
    <button
      className={className}
      onClick={() =>
        document
          .getElementById("preview-note")
          ?.scrollIntoView({ behavior: "smooth" })
      }
    >
      {children}
    </button>
  );
}
function PublicBoard({
  tools,
  preview = false,
}: {
  tools: typeof samples;
  preview?: boolean;
}) {
  const [category, setCategory] = useState("All tools"),
    [search, setSearch] = useState("");
  const filtered = tools.filter(
    (t) =>
      (category === "All tools" || category === t.category) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="dot" /> GOOD NEIGHBORS. GREAT POSSIBILITIES.
          </div>
          <h1>
            A little help,
            <br />
            closer to <span>home.</span>
            <svg className="underline" viewBox="0 0 260 15" aria-hidden="true">
              <path
                d="M3 10 Q120 -3 254 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p>
            Borrow what you need. Lend what you don’t.
            <br />
            Turn the things sitting in your shed into a little
            <br className="desktop" /> more connection on your street.
          </p>
          <Show when="signed-out">
            <SignIn>
              Sign in to lend or borrow <ArrowUpRight size={18} />
            </SignIn>
          </Show>
          <Show when="signed-in">
            <a href="#browse" className="button primary">
              Browse neighborhood tools <ArrowRight size={18} />
            </a>
          </Show>
          <div className="hero-foot">
            <span className="mini-icon">
              <HeartHandshake size={18} />
            </span>{" "}
            Less buying. More belonging.
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Tools and a plant arranged in a neighborhood borrowing collection"
          role="img"
        >
          <div className="art-grid" />
          <span className="art-label">
            <MapPin size={13} /> THE GOOD THINGS ARE NEARBY
          </span>
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-tile drill">
            <Wrench size={85} strokeWidth={1.2} />
            <span>For the weekend fix.</span>
          </div>
          <div className="art-tile plant">
            <Sprout size={100} strokeWidth={1.1} />
          </div>
          <div className="art-tile tent">
            <Tent size={80} strokeWidth={1.2} />
            <span>For a little adventure.</span>
          </div>
          <div className="art-badge">
            <span className="circle-check">
              <Check size={18} />
            </span>
            <div>
              Good things, shared.
              <small>A neighborhood with more to give.</small>
            </div>
          </div>
          <span className="spark spark-one">✳</span>
          <span className="spark spark-two">✳</span>
        </div>
      </section>
      <div className="values-strip">
        <span>
          <ShieldCheck size={19} /> You’re in control of what you lend
        </span>
        <span>
          <HeartHandshake size={19} /> Built around your neighborhood
        </span>
        <span>
          <Leaf size={19} /> A little kinder to the planet
        </span>
      </div>
      <section className="board" id="browse">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE NEIGHBORHOOD SHELF</div>
            <h2>Someone nearby has just the thing.</h2>
            <p>Big plans don’t always need a new purchase.</p>
          </div>
          <span className="count-label">
            {tools.length} tools to discover <ArrowDown />
          </span>
        </div>
        <div className="filter-row">
          <div className="pills" aria-label="Filter tools by category">
            {["All tools", ...categories].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`pill ${category === c ? "active" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <span className="sr-only">Search tools</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a tool…"
            />
          </label>
        </div>
        {preview && (
          <p className="preview-note" id="preview-note">
            Design preview · Sample listings. Live sign-in and lending become
            available after service configuration.
          </p>
        )}
        <div className="tool-grid">
          {filtered.map((t, i) => (
            <article className="tool-card" key={`${t.name}-${i}`}>
              <div
                className={`tool-visual color-${categories.indexOf(t.category as (typeof categories)[number]) % 4}`}
              >
                <CategoryIcon category={t.category} size={62} />
                <span className="visual-corner">
                  <ArrowUpRight size={18} />
                </span>
              </div>
              <div className="tool-body">
                <span className="category-label">{t.category}</span>
                <h3>{t.name}</h3>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty">
            <Package size={30} />
            <h3>No tools on this shelf yet.</h3>
            <p>Try another category, or be the first to lend a hand.</p>
          </div>
        )}
      </section>
      <section className="how" id="how">
        <div>
          <div className="eyebrow">SMALL FAVORS. BIG DIFFERENCE.</div>
          <h2>A better way to get things done.</h2>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Find your thing",
              "Explore tools your neighbors are happy to share.",
            ],
            [
              "02",
              "Make a plan",
              "Choose your dates and send a borrowing request.",
            ],
            [
              "03",
              "Bring it back",
              "Return it with care. Keep the good going.",
            ],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="cta">
        <div>
          <h2>Your shelf could make someone’s day.</h2>
          <p>
            That tool you use twice a year? It could be someone’s next great
            idea.
          </p>
        </div>
        <SignIn>
          Join the loop <Plus size={18} />
        </SignIn>
      </section>
    </>
  );
}
function ArrowDown() {
  return <ArrowRight size={16} className="rotate" />;
}
function LivePublic() {
  const tools = useQuery(api.tools.publicList, {});
  return tools ? (
    <PublicBoard tools={tools} />
  ) : (
    <div className="loading" role="status">
      Opening the neighborhood shelf…
    </div>
  );
}
export default function Page() {
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="LendLoop home">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          LendLoop<span className="brand-period">.</span>
        </a>
        <nav>
          <a href="#browse">Explore tools</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="nav-action">
          {configured ? (
            <>
              <Unauthenticated>
                <SignIn className="button small">
                  Join your neighbors <ArrowUpRight size={16} />
                </SignIn>
              </Unauthenticated>
              <Authenticated>
                <UserButton />
              </Authenticated>
            </>
          ) : hasClerk ? (
            <>
              <Show when="signed-in">
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignIn className="button small">
                  Join your neighbors <ArrowUpRight size={16} />
                </SignIn>
              </Show>
            </>
          ) : (
            <SignIn className="button small">
              Join your neighbors <ArrowUpRight size={16} />
            </SignIn>
          )}
        </div>
      </header>
      <main>
        {configured ? (
          <>
            <AuthLoading>
              <div className="loading">Opening LendLoop…</div>
            </AuthLoading>
            <Unauthenticated>
              <LivePublic />
            </Unauthenticated>
            <Authenticated>
              <Dashboard />
            </Authenticated>
          </>
        ) : (
          <PublicBoard tools={samples} preview />
        )}
      </main>
      <footer>
        <a className="brand" href="/">
          LendLoop<span className="brand-period">.</span>
        </a>
        <span>A little less stuff. A little more community.</span>
        <span>
          Made for good neighbors <Leaf size={13} />
        </span>
      </footer>
    </>
  );
}
