import React, { useRef, useState, useEffect } from "react";
import {
  useSequentContext,
  useSequentFlow,
  useSequentStep,
} from "react-sequent";

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
  // react-sequent
  useSequentContext,
  useSequentFlow,
  useSequentStep,
};

export default ReactLiveScope;
