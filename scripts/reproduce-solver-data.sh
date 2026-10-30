#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
solver_repo="${1:?usage: scripts/reproduce-solver-data.sh <pinned-postflop-checkout> [output.json]}"
output_path="${2:-$repo_root/src/solver/data/river-k72-oop-a4s-v1.json}"
expected_commit="5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de"
patch_file="$repo_root/codex/patches/ucsandman-postflop-5fc7ee3-fix-zero-sum-gains.patch"
config_file="$repo_root/codex/solver-fixtures/river-k72-oop-a4s-v1.toml"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

actual_commit="$(git -C "$solver_repo" rev-parse HEAD)"
if [[ "$actual_commit" != "$expected_commit" ]]; then
  echo "expected solver commit $expected_commit, found $actual_commit" >&2
  exit 1
fi
if ! git -C "$solver_repo" diff --cached --quiet; then
  echo "solver checkout has staged modifications" >&2
  exit 1
fi

if git -C "$solver_repo" diff --quiet -- engine/src/br.rs; then
  if ! git -C "$solver_repo" diff --quiet --; then
    echo "solver checkout has unexpected local modifications" >&2
    exit 1
  fi
  git -C "$solver_repo" apply --unidiff-zero --check "$patch_file"
  git -C "$solver_repo" apply --unidiff-zero "$patch_file"
fi

git -C "$solver_repo" diff --binary --unified=0 > "$temp_dir/actual-patch"
if ! cmp -s "$patch_file" "$temp_dir/actual-patch"; then
  echo "solver checkout does not have the documented local patch applied exactly" >&2
  exit 1
fi
if ! git -C "$solver_repo" diff --quiet -- . \
  ':(exclude)engine/src/br.rs' \
  ':(exclude)engine/src/nlhe.rs' \
  ':(exclude)engine/src/solution.rs'; then
  echo "solver checkout has modifications outside the documented patch" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"
(
  cd "$solver_repo"
  cargo run --release --locked -p solver-cli -- solve \
    --config "$config_file" \
    --report-every 100 \
    --threads 1 \
    --out "$temp_dir/solver-output.json"
)

cd "$repo_root"
npm run solver:export -- "$temp_dir/solver-output.json" "$config_file" "$output_path"
sha256sum "$output_path"
