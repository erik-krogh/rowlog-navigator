import * as colors from "ansi-colors";
import enquirer from "enquirer";
import * as fs from "fs";
import * as path from "path";
const {
  AutoComplete: EnquirerAutocomplete,
  Input,
  Confirm,
} = require("enquirer");

export type Choice = { message?: string; name: string; hint?: string };

export type StringOrChoice = string | Choice;

export async function ask<T extends string = string>(
  text: string,
  choices?: (T | StringOrChoice)[]
): Promise<T> {
  if (!choices) {
    const answer = await enquirer.prompt<{ answer: string }>({
      type: "input",
      name: "answer",
      message: text,
    });
    return answer.answer as T;
  }

  const prompt = new AutoComplete({
    type: "autocomplete",
    message: text,
    limit: 10,
    scroll: true,
    footer: footer,
    choices: fixupChoices(choices),
    pointer(choice: any, i: number) {
      return this.state.index === i ? colors.green("→") : " ";
    },
  });

  const answer = await prompt.run();

  return answer;
}

function footer(state: any) {
  if (state.limit < state.choices.length) {
    return colors.dim("(Scroll up and down to reveal more choices)");
  }
}

export async function multiple(
  text: string,
  choices: StringOrChoice[]
): Promise<string[]> {
  const prompt = new AutoComplete({
    type: "autocomplete",
    multiple: true,
    hint: "(Use <space> to select, <return> to submit)",
    name: "choices",
    message: text,
    choices: fixupChoices(choices),
    limit: 10,
    scroll: true,
    footer: footer,
  });

  const result: string[] = await prompt.run();

  if (result.length === 0) {
    console.log(colors.red.bold("Nothing was selected!"));
    console.log(
      colors.red(
        "You need to press " + colors.bold("<space>") + " to select something."
      )
    );
    return await multiple(text, choices);
  }

  return result;
}

/*
 * In the exposed API the message is optional, but enquirer requires it.
 */
function fixupChoices(choices: StringOrChoice[]): StringOrChoice[] {
  return choices.map((choice) => {
    if (typeof choice === "object" && !choice.message) {
      return { message: choice.name, ...choice };
    } else if (typeof choice === "string") {
      return { message: choice, name: choice };
    } else {
      return choice;
    }
  });
}

export async function confirm(
  message: string,
  defaultChoice = true,
  secondsTimeout = 0
): Promise<boolean> {
  if (!secondsTimeout) {
    const answer = await enquirer.prompt<{ answer: boolean }>({
      type: "confirm",
      name: "answer",
      message,
      initial: defaultChoice,
    });
    return answer.answer;
  }

  let result: boolean | null = null;

  const prompt = new Confirm({
    type: "confirm",
    name: "answer",
    message,
    initial: defaultChoice,
  });

  const answerPromise = prompt.run();

  let secondsLeft = secondsTimeout;

  async function updateHint() {
    if (result !== null) {
      return;
    }
    if (secondsLeft === 0) {
      await prompt.submit();
      console.log(
        colors.yellow(
          "No answer given, using default " + colors.bold(defaultChoice + "")
        )
      );
    } else {
      prompt.hint = () =>
        colors.dim(`defaulting to ${defaultChoice} in ${secondsLeft} seconds`);
      prompt.render();
      setTimeout(() => void updateHint(), 1000);
    }
    secondsLeft--;
  }
  void updateHint(); // <- not awaiting

  result = await answerPromise;

  return result;
}

/**
 * Prompts for a file with extension `ext`.
 * Supports tab completion.
 */
export async function file(message: string, ext?: string): Promise<string> {
  const prompt = new Input({
    type: "input",
    name: "file",
    hint: "You can use tab completion.",
    message: message,
    alert: () => {
      /* nothing */
    },
    format() {
      if (prompt.state.hint) {
        return prompt.input + " " + prompt.styles.muted(prompt.state.hint);
      } else {
        return prompt.input;
      }
    },
  });

  let prevInput: string = "";
  prompt.on("keypress", (input: any, key: any) => {
    prompt.state.hint = "";
    if (key.name === "tab") {
      let input = prompt.input;
      if (input === "") {
        return;
      }
      if (input[0] === "~") {
        // add the home dir
        input = path.join(require("os").homedir(), input.slice(1));
      }
      const p = path.resolve(process.cwd(), input);
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        return;
      }
      const file = path.basename(p);
      let completions: string[];
      try {
        completions = fs
          .readdirSync(dir)
          .filter((f) => {
            return (
              f.startsWith(file) &&
              (typeof ext === "undefined" ||
                f.endsWith(ext) ||
                !f.includes("."))
            );
          })
          .map((f) => {
            if (fs.lstatSync(path.join(dir, f)).isDirectory()) {
              return f.slice(file.length) + "/";
            } else {
              return f.slice(file.length);
            }
          })
          .filter((f) => !(f === "/" && input.endsWith("/")));
      } catch (ignored) {
        // access denied or similar
        completions = [];
      }
      if (completions.length === 1) {
        const completion = completions[0];
        prompt.input += completion;
        prompt.cursor += completion.length;
        prompt.render();
      } else if (completions.length > 1) {
        let commonStr = "";
        let i = 0;
        outer: while (true) {
          const char = completions[0][i];
          for (const completion of completions.slice(1)) {
            if (completion.length <= i || completion[i] !== char) {
              break outer;
            }
          }
          commonStr += char;
          i++;
        }
        if (commonStr.length > 0) {
          prompt.input += commonStr;
          prompt.cursor += commonStr.length;
          prompt.render();
        } else if (prevInput === input) {
          // Tab twice. Show options in hint.
          prompt.state.hint = completions.join(" ");
          prompt.render();
        }
      }
      prevInput = input;
    }
  });

  let res = await prompt.run();
  if (res[0] === "~") {
    res = path.join(require("os").homedir(), res.slice(1));
  }

  return path.resolve(res);
}

/**
 * Registers the magic keypresses such as `ctrl + d` on an empty input (which exists the wizard).
 */
function registerKeypresses(enquirer: any) {
  enquirer.on("keypress", (input: any, key: any) => {
    if (key.name === "u" && key.ctrl) {
      const length = enquirer.input.length;
      enquirer.input = "";
      enquirer.cursor -= length;
      void enquirer.render();
    }
    if (key.name === "d" && key.ctrl && enquirer.input.trim() === "") {
      console.log(colors.red.bold("Exiting wizard"));
      process.exit(0);
    }
    if (key.name === "escape") {
      console.log(colors.red.bold("Exiting wizard"));
      process.exit(0);
    }
  });
}

type AurgmentedChoice = Choice & {
  orgIndex: number;
  currentIndex: number;
};

/**
 * An autocompleter that highlights the chars in the longest common
 * subsequence.
 */
class AutoComplete extends EnquirerAutocomplete {
  constructor(options: object) {
    super(options);
    registerKeypresses(this);
    let i = 0;
    for (const choice of this.choices) {
      choice.orgIndex = i;
      choice.currentIndex = i;
      i++;
    }
  }

  // The `array.js` getter/setter for choices in `enquirer` runs in O(n^2), and we don't use most of the functionality.
  // This is a reimplementation of the parts we use, that performs in O(n).
  set choices(choices) {
    this.state._choices = this.state._choices || [];
    this.state._choiceNames = this.state._choiceNames || new Set();
    this.state.choices = choices || [];

    const existingNames = this.state._choiceNames;

    for (let choice of choices) {
      if (!existingNames.has(choice.name)) {
        this.state._choices.push(choice);
        existingNames.add(choice.name);
      }
    }
  }
  get choices() {
    return this.state.choices || [];
  }

  static highlight(input: string, color: (s: string) => string, str: string) {
    const underlined: number[] = AutoComplete.getSubsequenceIndexes(
      str.toLowerCase(),
      input.toLowerCase()
    );
    let sliced = str.split("");
    // underline the indexes `underlined` in `str`.
    for (const i of underlined) {
      sliced[i] = colors.bold(color(sliced[i]));
    }
    return sliced.join("");
  }

  /**
   * Gets the indexes of the chars from `str` in the subsequence `substr` in `str`.
   * Does a greedy search for the longest contiguous subsequences.
   */
  static getSubsequenceIndexes(message: string, typed: string): number[] {
    message = message.toLowerCase();
    typed = typed.toLowerCase();

    const result: number[] = [];
    let index = 0;
    outer: while (typed.length > 0) {
      for (var l = typed.length - 1; l >= 0; l--) {
        const i = message.indexOf(typed.slice(0, l + 1), index);
        if (i !== -1) {
          index = i;
          typed = typed.slice(l + 1);
          for (var res = index; res <= index + l; res++) {
            result.push(res);
          }
          continue outer;
        }
      }
      break;
    }
    return result;
  }

  /**
   * Holds if `substr` is a subsequence of `str`.
   */
  private static hasSubsequence(str: string, sequence: string): boolean {
    str = str.toLowerCase();
    sequence = sequence.toLowerCase();
    let i = 0;
    let j = 0;
    while (i < str.length && j < sequence.length) {
      if (str[i] === sequence[j]) {
        i++;
        j++;
      } else {
        i++;
      }
    }
    return j === sequence.length;
  }

  async render() {
    if (this.state.status !== "pending") return super.render();
    let style = this.options.highlight
      ? this.options.highlight.bind(this)
      : this.styles.placeholder;

    let choices = this.choices;
    this.choices = choices
      .map((ch: Choice) => ({
        ...ch,
        message: AutoComplete.highlight(this.input, style, ch.message),
      }))
      .slice(0, 100);
    await super.render();
    this.choices = choices;
  }

  suggest(typed: string, choices: AurgmentedChoice[]): Choice[] {
    choices = choices.sort((a: AurgmentedChoice, b: AurgmentedChoice) => {
      return a.orgIndex - b.orgIndex;
    });
    if (
      typed.trim() === "" ||
      (typed.length === 1 && typed.charCodeAt(0) < 32)
    ) {
      // we can get a char code below 32 if we get some control char, like after pressing ctrl+u
      this.input = "";
      this.cursor = 0;
      return choices;
    }
    typed = typed.toLowerCase();

    const split = typed.split(/[,;\s]+/).reverse();

    let result = split
      .map((typed) => {
        // filter out the choices we are going to present.
        const filtered = choices.filter(
          (ch) =>
            AutoComplete.hasSubsequence(ch.message.toLowerCase(), typed) ||
            (ch.hint &&
              AutoComplete.hasSubsequence(ch.hint.toLowerCase(), typed))
        );

        return filtered
          .map(
            (choice) =>
              [choice, AutoComplete.getChoicePriority(choice, typed)] as [
                Choice,
                number
              ]
          )
          .sort((a, b) => a[1] - b[1])
          .map((a) => a[0]);
      })
      .reduce((a, b) => a.concat(b), []);

    result = [...new Set(result)];
    for (let i = 0; i < result.length; i++) {
      (result[i] as any).currentIndex = i;
    }

    return result;
  }

  private static getChoicePriority(choice: Choice, typed: string): number {
    const message = choice.message.toLowerCase();
    const hint = choice.hint ? choice.hint.toLowerCase() : "";
    if (message.indexOf(typed) !== -1) {
      // first the exact matches
      // sorted by where the match is (earlier matches are better)
      return 1 + message.indexOf(typed) / 1000;
    } else if (AutoComplete.getSubSequenceWeight(message, typed)) {
      // then the matches that are a subsequence of the typed string
      // sorted by the length of the longest contiguous subsequence of the typed string in the message
      return (
        2 +
        (message.length - AutoComplete.getSubSequenceWeight(message, typed)) /
          1000
      );
    } else if (hint && AutoComplete.getSubSequenceWeight(hint, typed)) {
      // same, but for hints
      return (
        3 +
        (hint.length - AutoComplete.getSubSequenceWeight(hint, typed)) / 1000
      );
    } else {
      return 4;
    }
  }

  /**
   * returns 0 if `str` does not contain the subsequence `substr`.
   * Otherwise returns `sum(len(subseq)^2)`, where `subsub` is each contiguous subsequence of `substr` in `str`.
   * For example, if `str` is "abcdefg" and `substr` is "bcdfg", then the result is `(3^2 + 2^2) = 13`.
   * The search for longest contiguous subsequence is greedy.
   */
  private static getSubSequenceWeight(str: string, sequence: string): number {
    const indexes = AutoComplete.getSubsequenceIndexes(str, sequence);
    if (indexes.length === 0) {
      return 0;
    }
    var sum = 0;
    var index = -2;
    var currentLength = 0;
    for (const i of indexes) {
      if (i == index + 1) {
        currentLength++;
      } else {
        sum += currentLength * currentLength;
        currentLength = 1;
      }
      index = i;
    }

    return sum + currentLength * currentLength;
  }

  async down(): Promise<void> {
    // custom down method based on the original in array.js (in enquirer)
    let len = this.choices.length;
    let vis = this.visible.length;
    let idx = this.index;
    if (this.options.scroll === false && idx === len - 1) {
      return this.alert();
    }
    if (len === vis && idx === len - 1) {
      return this.alert(); // at the bottom - when there is no scrolling
    }
    if (len > vis && idx === vis - 1) {
      if (this.choices[idx + 1].currentIndex < this.choices[idx].currentIndex) {
        // <- custom part. Stop at the bottom.
        return this.alert();
      } else {
        return this.scrollDown();
      }
    }
    this.index = (idx + 1) % len;
    if (this.isDisabled()) {
      return this.down();
    }
    return this.render();
  }

  async up(): Promise<void> {
    // custom up method based on the original in array.js (in enquirer)
    let len = this.choices.length;
    let vis = this.visible.length;
    let idx = this.index;
    const next = (idx - (1 % len) + len) % len;
    // custom part. Stop at the top.
    if (
      idx === 0 &&
      this.choices[idx].currentIndex < this.choices[next].currentIndex
    ) {
      return this.alert();
    }
    if (this.options.scroll === false && idx === 0) {
      return this.alert();
    }
    if (len > vis && idx === 0) {
      return this.scrollUp();
    }
    this.index = next;
    if (this.isDisabled()) {
      return this.up();
    }
    return this.render();
  }
}
