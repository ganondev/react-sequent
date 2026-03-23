import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import CodeBlock from "@theme/CodeBlock";

import styles from "./index.module.css";

const features = [
  {
    title: "Zero Config",
    description:
      "No state machine definitions, no transition maps. Each step decides what comes next with a plain function call.",
  },
  {
    title: "Async-First",
    description:
      "Dynamic imports and backend fetches just work. Suspense built-in — your step components stay clean.",
  },
  {
    title: "Chrome-Stable",
    description:
      "Modal headers, progress bars, and other stable UI stay mounted across step transitions and async loading.",
  },
];

const quickExample = `import { useRef } from "react";
import {
  FlowOutlet,
  useFlowInit,
  useStep,
} from "react-sequent";

function Step1() {
  const { advance } = useStep();
  return (
    <div>
      <h3>Welcome</h3>
      <button onClick={() => advance(Step2)}>
        Next
      </button>
    </div>
  );
}

function Step2() {
  const { retreat, resolve } = useStep();
  return (
    <div>
      <h3>Confirm</h3>
      <button onClick={() => retreat()}>Back</button>
      <button onClick={() => resolve("done")}>
        Finish
      </button>
    </div>
  );
}

function App() {
  const ref = useRef(null);
  const { initFlow } = useFlowInit();

  return (
    <>
      <FlowOutlet ref={ref} />
      <button onClick={() => initFlow(Step1, ref)}>
        Start Flow
      </button>
    </>
  );
}`;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <code className={styles.installBadge}>npm i react-sequent</code>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started"
          >
            Get Started
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/docs/api/use-flow-init"
            style={{ marginLeft: "1rem" }}
          >
            API Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={clsx("col col--4")}>
      <div className="feature-card" style={{ height: "100%" }}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function TheParadigm() {
  return (
    <section className={styles.paradigm}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <Heading as="h2" className="text--center">
              The step decides what comes next
            </Heading>
            <p className="text--center" style={{ fontSize: "1.1rem" }}>
              Most wizard libraries require a centralized state map that knows
              every step and transition upfront. <strong>react-sequent</strong>{" "}
              inverts this — transitions emerge from step-level logic.
              Add, remove, or reorder steps without touching a config. Branching
              is an <code>if</code> statement, not a schema.
            </p>
            <div className="text--center" style={{ marginTop: "2rem" }}>
              <Link
                className="button button--primary button--lg"
                to="/docs/demos/subsection-flow"
              >
                See Examples in Action
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RightFit() {
  return (
    <section className={styles.rightFit}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{ marginBottom: "2rem" }}>
          Is this the right fit for my project?
        </Heading>
        <div className="row">
          <div className="col col--8 col--offset-2">
            <p className="text--center" style={{ marginBottom: "2rem" }}>
              <strong>react-sequent</strong> is designed for short, simple flows
              where the UI outside the flow remains stable. If you have a long,
              complex, or highly context-sensitive flow, or if you want your
              your flow coupled to external state, a more traditional
              state machine or flow library might be a better fit.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col col--10 col--offset-1">
          <table>
            <thead>
              <tr>
                <th className={styles.rightFitQuestionCell} />
                <th>react-sequent</th>
                <th>Alternatives (XState, React Flow, etc.)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.rightFitQuestionCell}>Opinionated?</td>
                <td>Opinionated on architecture, not structure.</td>
                <td>Opinionated on architecture and structure.</td>
              </tr>
              <tr>
                <td className={styles.rightFitQuestionCell}>Iteration and prototyping pace?</td>
                <td>Fast iteration and prototyping.</td>
                <td>Slower iteration due to coupled state management.</td>
              </tr>
              <tr>
                <td className={styles.rightFitQuestionCell}>Boilerplate?</td>
                <td>Minimal boilerplate required.</td>
                <td>Some boilerplate, depending on the utility.</td>
              </tr>
              <tr>
                <td className={styles.rightFitQuestionCell}>Flow Specialization?</td>
                <td>Short, simple flows.</td>
                <td>Long, complex, or context-sensitive flows.</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickExample() {
  return (
    <section className={styles.example}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <Heading as="h2" className="text--center">
              Minimal example
            </Heading>
            <CodeBlock language="tsx" title="App.tsx">
              {quickExample}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Step-driven React flows"
      description={siteConfig.tagline}
    >
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>
        <TheParadigm />
        <RightFit />
        <QuickExample />
      </main>
    </Layout>
  );
}
