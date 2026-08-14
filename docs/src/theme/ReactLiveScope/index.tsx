import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  useSequentContext,
  useSequentFlow,
  useSequentStep,
} from "react-sequent";
import { crossfade, slide } from "react-sequent/transitions";

/**
 * ReactLiveScope — injects react-sequent exports and common React APIs
 * into every `jsx live` code block on the site.
 *
 * Doc: https://docusaurus.io/docs/markdown-features/code-blocks#interactive-code-editor
 */
const ReactLiveScope: Record<string, unknown> = {
  React,
  ...React,
  useRef,
  useState,
  useEffect,
  // motion
  motion,
  // react-sequent
  useSequentContext,
  useSequentFlow,
  useSequentStep,
  // react-sequent/transitions
  crossfade,
  slide,
};

export default ReactLiveScope;
