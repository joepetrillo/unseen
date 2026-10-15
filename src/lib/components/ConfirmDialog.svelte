<script lang="ts">
  import * as AlertDialog from "#lib/components/ui/alert-dialog/index.ts";

  interface Props {
    /** Bindable: the page opens it, and either button closes it. */
    open?: boolean;
    title: string;
    description: string;
    /** The confirm button's words, naming the action ("Reset invite"). */
    confirmLabel: string;
    /** Red confirm button, for something that can't be taken back. */
    destructive?: boolean;
    /** Runs on confirm, usually `form.requestSubmit()`. */
    onconfirm: () => void;
  }

  let {
    open = $bindable(false),
    title,
    description,
    confirmLabel,
    destructive = false,
    onconfirm,
  }: Props = $props();
</script>

<!-- Asks before a change that's hard to undo, instead of the browser's
     confirm(). An alert dialog: no closing by tapping outside, so a stray tap
     can't be read as either answer. -->
<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <!-- Group and member names can be one long word: let them break. -->
      <AlertDialog.Title class="wrap-anywhere">{title}</AlertDialog.Title>
      <AlertDialog.Description class="wrap-anywhere">
        {description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel size="lg">Cancel</AlertDialog.Cancel>
      <!-- The dialog is drawn outside the page's form (a portal), so it
           submits the form through the page instead of being its button. -->
      <AlertDialog.Action
        size="lg"
        variant={destructive ? "destructive" : "default"}
        onclick={() => {
          open = false;
          onconfirm();
        }}
      >
        {confirmLabel}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
