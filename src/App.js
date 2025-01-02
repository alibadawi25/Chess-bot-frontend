import "./App.css";
import { useEffect, useState } from "react";
import axios from "axios";

// Popup component for piece selection
const PromotionPopup = ({ onClose, onSelectPiece }) => {
  return (
    <div className="promotion-popup">
      <h3>Select a piece to promote the pawn to:</h3>
      <button onClick={() => onSelectPiece("Q")}>Queen</button>
      <button onClick={() => onSelectPiece("R")}>Rook</button>
      <button onClick={() => onSelectPiece("B")}>Bishop</button>
      <button onClick={() => onSelectPiece("N")}>Knight</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default function App() {
  const n = 8; // Number of rows
  const m = 8; // Number of columns

  const [boardState, setBoardState] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null); // To track selected square
  const [highlightedSquares, setHighlightedSquares] = useState([]); // To track possible moves
  const [showPromotionPopup, setShowPromotionPopup] = useState(false); // To control promotion popup visibility
  const [pawnToPromote, setPawnToPromote] = useState(null); // To track the pawn that needs promotion

  const pieceImages = {
    bP: "/assets/images/bP.png", // Black Pawn
    wP: "/assets/images/wP.png", // White Pawn
    bR: "/assets/images/bR.png", // Black Rook
    wR: "/assets/images/wR.png", // White Rook
    bN: "/assets/images/bN.png", // Black Knight
    wN: "/assets/images/wN.png", // White Knight
    bB: "/assets/images/bB.png", // Black Bishop
    wB: "/assets/images/wB.png", // White Bishop
    bQ: "/assets/images/bQ.png", // Black Queen
    wQ: "/assets/images/wQ.png", // White Queen
    bK: "/assets/images/bK.png", // Black King
    wK: "/assets/images/wK.png", // White King
  };

  useEffect(() => {
    // Fetch the board state from the Flask backend
    axios
      .get("http://192.168.1.9:5000/get_board_state")
      .then((response) => {
        setBoardState(response.data.board_state);
      })
      .catch((error) => {
        console.error("Error fetching board state:", error);
      });
  }, []);

  const parseFen = (fen) => {
    const rows = fen.split(" ")[0].split("/");
    const board = rows.map((row) => {
      const parsedRow = [];
      for (let char of row) {
        if (/[1-8]/.test(char)) {
          const emptySquares = parseInt(char, 10);
          parsedRow.push(...Array(emptySquares).fill(null));
        } else {
          parsedRow.push(char);
        }
      }
      return parsedRow;
    });

    return board;
  };

  const getPieceImage = (piece) => {
    if (!piece) return null;

    const pieceColor = piece === piece.toUpperCase() ? "w" : "b";
    const pieceType = piece.toUpperCase(); // 'P', 'R', 'N', 'B', 'Q', 'K'
    const pieceKey = pieceColor + pieceType;

    return pieceImages[pieceKey] || null;
  };

  // Check if the pawn is eligible for promotion
  const checkPawnPromotion = (board, to, from) => {
    const [col, row] = from.split(""); // Convert notation 'e8' -> ['e', '8']
    const rowIndex = 8 - parseInt(row, 10); // Convert row to index (8 -> 0, 7 -> 1, etc.)
    const colIndex = col.charCodeAt(0) - 97; // Convert column letter to index (e -> 4)
    const parsedBoard = parseFen(boardState);

    const [to_col, to_row] = to.split(""); // Convert notation 'e8' -> ['e', '8']
    const toRowIndex = 8 - parseInt(to_row, 10); // Convert row to index (8 -> 0, 7 -> 1, etc.)
    const toColIndex = to_col.charCodeAt(0) - 97; // Convert column letter to index (e -> 4)

    const piece = parsedBoard[rowIndex][colIndex]; // Get the piece at the target position
    console.log(piece, toRowIndex, toColIndex);
    console.log(parsedBoard);
    // Check if it's a white pawn (P) at the last row (row 0)
    if (piece === "P" && toRowIndex === 0) {
      return { piece, col, row, to_col, to_row }; // White pawn, promote to a piece
    }

    // Check if it's a black pawn (p) at the last row (row 7)
    if (piece === "p" && toRowIndex === 7) {
      return { piece, col, row, to_col, to_row }; // White pawn, promote to a piece
    }

    return null; // No promotion needed
  };

  const handleMove = (from, to) => {
    if (selectedSquare) {
      const move = `${to}${from}`; // Simplified move notation like 'e2e4'

      const promotedPawn = checkPawnPromotion(boardState, from, to);
      if (promotedPawn) {
        setPawnToPromote(promotedPawn);
        setShowPromotionPopup(true);
        return; // Stop the move from being made until promotion is handled
      }

      // Send the player's move to the backend
      axios
        .post("http://192.168.1.9:5000/make_move", { move })
        .then((response) => {
          if (response.data.success) {
            setBoardState(response.data.board_state);
            setSelectedSquare(null);
            setHighlightedSquares([]);
            if (response.data.checkmate) {
              // Render the checkmate state
              setBoardState(response.data.board_state);

              // Use a slight delay to allow the user to see the checkmate position
              setTimeout(() => {
                alert("Checkmate! The game is over.");

                // Reset the board
                axios
                  .post("/reset_board")
                  .then((resetResponse) => {
                    if (resetResponse.data.success) {
                      console.log(resetResponse.data.message);
                      setBoardState(resetResponse.data.board_state); // Update with the new board
                    } else {
                      console.error("Failed to reset the board.");
                    }
                  })
                  .catch((error) => {
                    console.error(
                      "An error occurred while resetting the board:",
                      error
                    );
                  });
              }, 1000); // 1-second delay for better user experience
            }

            // Now let the AI play its move
            playAI();
          } else {
            console.error(response.data.error);
            setSelectedSquare(null);
            setHighlightedSquares([]);
          }
        })
        .catch((error) => {
          console.error("Error making move:", error);
          setSelectedSquare(null);
          setHighlightedSquares([]);
        });
    } else {
      setSelectedSquare(from);
      getLegalMoves(from); // Fetch and highlight legal moves when a piece is selected
    }
  };

  // Function to trigger AI move after the player plays
  const playAI = () => {
    // Send a request to the backend to get the AI's move
    axios
      .get("http://192.168.1.9:5000/get_ai_move")
      .then((response) => {
        if (response.data.success) {
          setBoardState(response.data.board_state);
          setSelectedSquare(null);
          setHighlightedSquares([]);
          if (response.data.checkmate) {
            // Render the checkmate state
            setBoardState(response.data.board_state);

            // Use a slight delay to allow the user to see the checkmate position
            setTimeout(() => {
              alert("Checkmate! The game is over.");

              // Reset the board
              axios
                .post("http://192.168.1.9:5000/reset_board")
                .then((resetResponse) => {
                  if (resetResponse.data.success) {
                    console.log(resetResponse.data.message);
                    console.log(
                      "Reset board state:",
                      resetResponse.data.board_state
                    );

                    setBoardState(resetResponse.data.board_state); // Update with the new board
                  } else {
                    console.error("Failed to reset the board.");
                  }
                })
                .catch((error) => {
                  console.error(
                    "An error occurred while resetting the board:",
                    error
                  );
                });
            }, 1000); // 1-second delay for better user experience
          }
        } else {
          console.error(response.data.error);
        }
      })
      .catch((error) => {
        console.error("Error getting AI move:", error);
      });
  };

  const getLegalMoves = (square) => {
    axios
      .post("http://192.168.1.9:5000/get_legal_moves", { square })
      .then((response) => {
        const legalMoves = response.data.legal_moves || [];
        console.log("Legal moves:", legalMoves);

        // Only highlight squares if there are legal moves
        if (legalMoves.length > 0) {
          const highlightedSquares = legalMoves.map((move) => {
            const moveSquare = move.slice(2, 4); // Extract to square from move (e.g., 'e2e4' -> 'e4')
            return moveSquare;
          });
          setHighlightedSquares(highlightedSquares); // Update highlighted squares in state
        } else {
          // If there are no legal moves, do not select the square
          setSelectedSquare(null);
          setHighlightedSquares([]); // Clear any highlighted squares
        }
      })
      .catch((error) => {
        console.error("Error fetching legal moves:", error);
      });
  };

  const handlePromotionSelect = (pieceType) => {
    if (!pawnToPromote) {
      console.error("No pawn selected for promotion!");
      return;
    }
    const { piece, col, row, to_col, to_row } = pawnToPromote;

    const promotedPieceType =
      piece === piece.toUpperCase()
        ? pieceType.toUpperCase()
        : pieceType.toLowerCase();

    setShowPromotionPopup(false);
    setSelectedSquare(null);
    setHighlightedSquares([]);
    const move = `${pawnToPromote.col}${pawnToPromote.row}${pawnToPromote.to_col}${pawnToPromote.to_row}${promotedPieceType}`;
    axios
      .post("http://192.168.1.9:5000/make_move", { move })
      .then((response) => {
        if (response.data.success) {
          setBoardState(response.data.board_state);
          if (response.data.checkmate) {
            alert("Checkmate! The game is over.");
          }
        } else {
          console.error(response.data.error);
        }
      })
      .catch((error) => {
        console.error("Error making move:", error);
      });
  };

  const renderBoard = () => {
    if (!boardState) return null;

    const parsedBoard = parseFen(boardState);
    return parsedBoard.map((row, rIndex) => (
      <div className="row" key={rIndex}>
        {row.map((piece, cIndex) => {
          const pieceImage = getPieceImage(piece);
          const squareNotation = `${String.fromCharCode(97 + cIndex)}${
            8 - rIndex
          }`; // Converts to standard chess notation (e.g., "a1", "h8")

          const isSelected = selectedSquare === squareNotation;
          const isHighlighted = highlightedSquares.includes(squareNotation);

          return (
            <div
              className={`box ${
                rIndex % 2 === 0
                  ? cIndex % 2 === 0
                    ? "black"
                    : "white"
                  : cIndex % 2 === 0
                  ? "white"
                  : "black"
              } ${isSelected ? "selected" : ""} ${
                isHighlighted ? "highlighted" : ""
              }`}
              key={cIndex}
              onClick={() => handleMove(squareNotation, selectedSquare)} // Pass the square notation
            >
              {pieceImage && <img src={pieceImage} alt={piece} />}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <>
      <h1 style={{ textAlign: "center" }}>Chessboard</h1>
      <div className="chessboard">{renderBoard()}</div>
      {showPromotionPopup && (
        <PromotionPopup
          onSelectPiece={handlePromotionSelect}
          onClose={() => setShowPromotionPopup(false)}
        />
      )}
    </>
  );
}
